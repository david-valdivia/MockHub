const crypto = require('crypto');
const environmentRepo = require('../repositories/environmentRepository');
const groupRepo = require('../repositories/groupRepository');
const routeRepo = require('../repositories/routeRepository');
const ruleRepo = require('../repositories/ruleRepository');

class ContentHashService {
    hash(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
    }

    // Build a deterministic object for hashing (only content fields, no ids/timestamps)
    envContent(env) {
        return { name: env.name, base_path: env.basePath || env.base_path, description: env.description || '' };
    }

    groupContent(group) {
        return { name: group.name, sort_order: group.sortOrder ?? group.sort_order ?? 0 };
    }

    routeContent(route) {
        return { method: route.method, path_pattern: route.pathPattern || route.path_pattern, capture_requests: route.captureRequests ?? route.capture_requests ?? true };
    }

    ruleContent(rule) {
        return {
            name: rule.name || '',
            priority: rule.priority,
            conditions: rule.conditions,
            status_code: rule.statusCode ?? rule.status_code,
            content_type: rule.contentType ?? rule.content_type,
            body: rule.body,
            delay: rule.delay || 0,
            webhook_url: rule.webhookUrl ?? rule.webhook_url ?? null,
            webhook_method: rule.webhookMethod ?? rule.webhook_method ?? 'POST',
            webhook_headers: rule.webhookHeaders ?? rule.webhook_headers ?? {},
            webhook_body: rule.webhookBody ?? rule.webhook_body ?? null,
            webhook_delay: rule.webhookDelay ?? rule.webhook_delay ?? 0
        };
    }

    // Hash a route including all its rules (this is the atomic unit for sync)
    async routeWithRulesHash(routeId) {
        const route = await routeRepo.findById(routeId);
        if (!route) return null;
        const rules = await ruleRepo.findByRouteId(routeId);
        const data = {
            ...this.routeContent(route),
            rules: rules.map(r => this.ruleContent(r)).sort((a, b) => a.priority - b.priority)
        };
        return this.hash(data);
    }

    async groupHash(groupId) {
        const group = await groupRepo.findById(groupId);
        if (!group) return null;
        return this.hash(this.groupContent(group));
    }

    async envHash(envId) {
        const env = await environmentRepo.findById(envId);
        if (!env) return null;
        return this.hash(this.envContent(env));
    }

    // Build full metadata for an environment (used for _metadata.json in GitHub)
    async buildEnvironmentMetadata(envId) {
        const env = await environmentRepo.findById(envId);
        if (!env) return null;

        const groups = await groupRepo.findByEnvironmentId(envId);
        const metadata = {
            mockhub_version: '1.0',
            updated_at: new Date().toISOString(),
            environment: {
                hash: this.hash(this.envContent(env)),
                name: env.name
            },
            groups: {},
            routes: {}
        };

        for (const group of groups) {
            metadata.groups[group.slug || group.id] = {
                id: group.id,
                hash: this.hash(this.groupContent(group)),
                name: group.name
            };

            const routes = await routeRepo.findByGroupId(group.id);
            for (const route of routes) {
                const rules = await ruleRepo.findByRouteId(route.id);
                const routeData = {
                    ...this.routeContent(route),
                    rules: rules.map(r => this.ruleContent(r)).sort((a, b) => a.priority - b.priority)
                };
                metadata.routes[route.slug || route.id] = {
                    id: route.id,
                    groupSlug: group.slug || group.id,
                    hash: this.hash(routeData),
                    method: route.method,
                    path: route.pathPattern
                };
            }
        }

        return metadata;
    }
}

module.exports = new ContentHashService();
