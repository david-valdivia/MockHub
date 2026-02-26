const { match } = require('path-to-regexp');
const axios = require('axios');
const https = require('https');
const environmentRepository = require('../repositories/environmentRepository');
const routeRepository = require('../repositories/routeRepository');
const ruleRepository = require('../repositories/ruleRepository');
const requestLogRepository = require('../repositories/requestLogRepository');
const conditionEvaluator = require('./conditionEvaluator');
const templateEngine = require('./templateEngine');
const socketService = require('./socketService');

class MockRoutingEngine {
    async handleRequest(req, res, next) {
        const fullPath = req.path;

        // 1. Find matching environment by base_path
        const environments = await environmentRepository.findAllActive();
        let matchedEnv = null;
        let remainingPath = '';

        for (const env of environments) {
            if (fullPath === env.basePath || fullPath.startsWith(env.basePath + '/')) {
                matchedEnv = env;
                remainingPath = fullPath.slice(env.basePath.length) || '/';
                break; // environments sorted by path length DESC, first match wins
            }
        }

        if (!matchedEnv) {
            return next(); // No environment matched, pass to legacy handler
        }

        // 2. Find matching route by method + path pattern
        const routes = await routeRepository.findByEnvironmentId(matchedEnv.id);
        let matchedRoute = null;
        let params = {};

        // Normalize remainingPath to always start with /
        if (!remainingPath.startsWith('/')) remainingPath = '/' + remainingPath;

        for (const route of routes) {
            if (route.method !== 'ALL' && route.method !== req.method) continue;

            // Normalize pathPattern to always start with /
            const pattern = route.pathPattern.startsWith('/') ? route.pathPattern : '/' + route.pathPattern;
            const matchFn = match(pattern, { decode: decodeURIComponent });
            const result = matchFn(remainingPath);
            if (result) {
                matchedRoute = route;
                params = result.params;
                break;
            }
        }

        if (!matchedRoute) {
            return res.status(404).json({
                error: 'Route not found',
                environment: matchedEnv.name,
                path: remainingPath,
                method: req.method
            });
        }

        // 3. Build context for condition evaluation and template resolution
        // Pre-load request logs for exists_in_logs / not_exists_in_logs conditions
        const previousLogs = await requestLogRepository.findByRouteId(matchedRoute.id);
        const context = {
            params,
            query: req.query,
            body: req.body,
            headers: req.headers,
            method: req.method,
            _logs: previousLogs.map(log => ({
                body: log.body,
                requestBody: log.body,
                headers: log.headers,
                queryParams: log.queryParams,
                method: log.method,
                path: log.path,
                responseStatus: log.responseStatus,
                responseBody: this.tryParseJSON(log.responseBody),
                timestamp: log.timestamp
            }))
        };

        // 4. Evaluate rules in priority order
        const rules = await ruleRepository.findByRouteId(matchedRoute.id);
        let matchedRule = null;

        for (const rule of rules) {
            if (conditionEvaluator.evaluate(rule.conditions, context)) {
                matchedRule = rule;
                break;
            }
        }

        if (!matchedRule) {
            matchedRule = { statusCode: 200, contentType: 'application/json', body: '{"message":"OK"}', delay: 0, id: null };
        }

        // 4b. Expose matched log data for templates
        // {{logs.*}} = oldest (first) matching log
        // {{lastlog.*}} = newest (most recent) matching log
        if (context._matchedLog) {
            context.logs = context._matchedLog;
        }
        if (context._matchedLogLast) {
            context.lastlog = context._matchedLogLast;
        }

        // 5. Apply delay if configured
        if (matchedRule.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, matchedRule.delay));
        }

        // 6. Resolve template variables in body (clean invisible chars that break JSON)
        const cleanBody = (matchedRule.body || '').replace(/[\u00A0\u2000-\u200F\u2028\u2029\uFEFF]/g, ' ');
        const resolvedBody = templateEngine.resolve(cleanBody, context);

        // 7. Capture request if enabled
        let savedLog = null;
        if (matchedRoute.captureRequests) {
            const logData = {
                route_id: matchedRoute.id,
                environment_id: matchedEnv.id,
                method: req.method,
                path: fullPath,
                headers: JSON.stringify(req.headers),
                query_params: Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : null,
                body: req.rawXmlBody ? req.rawXmlBody : (req.body ? JSON.stringify(req.body) : null),
                matched_rule_id: matchedRule.id,
                response_status: matchedRule.statusCode,
                response_body: resolvedBody
            };

            savedLog = await requestLogRepository.create(logData);

            socketService.broadcastMessage('mockRequestReceived', {
                environmentId: matchedEnv.id,
                environmentName: matchedEnv.name,
                routeId: matchedRoute.id,
                requestLog: savedLog.toJSON()
            });
        }

        // 8. Send response
        res.status(matchedRule.statusCode)
            .type(matchedRule.contentType)
            .send(resolvedBody);

        // 9. Fire async webhook callback (fire-and-forget, after response is sent)
        if (matchedRule.webhookUrl && matchedRule.webhookEnabled !== false) {
            const webhookDelay = matchedRule.webhookDelay || 0;
            const fireWebhook = async () => {
                let resolvedWebhookUrl = matchedRule.webhookUrl;
                let resolvedWebhookBody = '';
                let resolvedHeaders = {};
                try {
                    const cleanWebhookBody = (matchedRule.webhookBody || '').replace(/[\u00A0\u2000-\u200F\u2028\u2029\uFEFF]/g, ' ');
                    resolvedWebhookBody = templateEngine.resolve(cleanWebhookBody, context);
                    resolvedWebhookUrl = templateEngine.resolve(matchedRule.webhookUrl, context);

                    // Parse and resolve custom headers
                    let parsedHeaders = matchedRule.webhookHeaders || {};
                    if (typeof parsedHeaders === 'string') {
                        try { parsedHeaders = JSON.parse(parsedHeaders); } catch (_) { parsedHeaders = {}; }
                    }
                    for (const [key, val] of Object.entries(parsedHeaders)) {
                        resolvedHeaders[key] = templateEngine.resolve(String(val), context);
                    }

                    // Set Content-Type from dedicated field, fallback to headers, then default
                    const webhookContentType = matchedRule.webhookContentType || 'application/json';
                    if (!resolvedHeaders['content-type'] && !resolvedHeaders['Content-Type']) {
                        resolvedHeaders['Content-Type'] = webhookContentType;
                    }

                    // Parse body as JSON for axios if content type is JSON
                    let data = resolvedWebhookBody;
                    const ct = (resolvedHeaders['content-type'] || resolvedHeaders['Content-Type'] || '').toLowerCase();
                    if (ct.includes('application/json') && data) {
                        try { data = JSON.parse(data); } catch (_) {}
                    }

                    const method = (matchedRule.webhookMethod || 'POST').toLowerCase();
                    const response = await axios({
                        method,
                        url: resolvedWebhookUrl,
                        headers: resolvedHeaders,
                        data: data || undefined,
                        timeout: 30000,
                        validateStatus: () => true,
                        httpsAgent: new https.Agent({ rejectUnauthorized: false })
                    });

                    console.log(`[Webhook Callback] ${method.toUpperCase()} ${resolvedWebhookUrl} → ${response.status} (after ${webhookDelay}ms delay)`);

                    // Persist webhook result to the request log
                    if (savedLog) {
                        const responseBody = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data || '');
                        const updatedLog = await requestLogRepository.updateWebhookResult(savedLog.id, {
                            webhook_url: resolvedWebhookUrl,
                            webhook_method: method.toUpperCase(),
                            webhook_request_headers: JSON.stringify(resolvedHeaders),
                            webhook_request_body: resolvedWebhookBody || null,
                            webhook_response_status: response.status,
                            webhook_response_headers: JSON.stringify(response.headers || {}),
                            webhook_response_body: responseBody
                        });

                        socketService.broadcastMessage('webhookResultUpdated', {
                            routeId: matchedRoute.id,
                            requestLog: updatedLog.toJSON()
                        });
                    }

                    socketService.broadcastMessage('webhookCallbackSent', {
                        environmentId: matchedEnv.id,
                        routeId: matchedRoute.id,
                        ruleId: matchedRule.id,
                        url: resolvedWebhookUrl,
                        method: method.toUpperCase(),
                        status: response.status,
                        delay: webhookDelay
                    });
                } catch (err) {
                    console.error(`[Webhook Callback Error] ${matchedRule.webhookUrl}:`, err.message);

                    // Persist webhook error to the request log
                    if (savedLog) {
                        const updatedLog = await requestLogRepository.updateWebhookResult(savedLog.id, {
                            webhook_url: resolvedWebhookUrl,
                            webhook_method: (matchedRule.webhookMethod || 'POST').toUpperCase(),
                            webhook_request_headers: JSON.stringify(resolvedHeaders),
                            webhook_request_body: resolvedWebhookBody || null,
                            webhook_error: err.message
                        });

                        socketService.broadcastMessage('webhookResultUpdated', {
                            routeId: matchedRoute.id,
                            requestLog: updatedLog.toJSON()
                        });
                    }

                    socketService.broadcastMessage('webhookCallbackError', {
                        environmentId: matchedEnv.id,
                        routeId: matchedRoute.id,
                        ruleId: matchedRule.id,
                        url: matchedRule.webhookUrl,
                        error: err.message
                    });
                }
            };

            if (webhookDelay > 0) {
                setTimeout(fireWebhook, webhookDelay);
            } else {
                setImmediate(fireWebhook);
            }
        }
    }
    tryParseJSON(str) {
        if (!str || typeof str !== 'string') return str;
        // Clean non-breaking spaces and other invisible chars that break JSON.parse
        const cleaned = str.replace(/[\u00A0\u2000-\u200F\u2028\u2029\uFEFF]/g, ' ');
        try { return JSON.parse(cleaned); } catch (e) { return str; }
    }
}

module.exports = new MockRoutingEngine();
