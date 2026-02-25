const { match } = require('path-to-regexp');
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
                headers: log.headers,
                queryParams: log.queryParams,
                method: log.method,
                path: log.path
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

        // 5. Apply delay if configured
        if (matchedRule.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, matchedRule.delay));
        }

        // 6. Resolve template variables in body
        const resolvedBody = templateEngine.resolve(matchedRule.body, context);

        // 7. Capture request if enabled
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

            const savedLog = await requestLogRepository.create(logData);

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
    }
}

module.exports = new MockRoutingEngine();
