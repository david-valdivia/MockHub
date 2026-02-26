const routeRepo = require('../repositories/routeRepository');
const ruleRepo = require('../repositories/ruleRepository');
const groupRepo = require('../repositories/groupRepository');
const Route = require('../models/route');
const Rule = require('../models/rule');
const socketService = require('../services/socketService');

class RouteController {
    async getByGroup(req, res) {
        try {
            const groupId = parseInt(req.params.groupId);
            const routes = await routeRepo.findByGroupId(groupId);
            res.json(routes.map(r => r.toJSON()));
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch routes' });
        }
    }

    async getById(req, res) {
        try {
            const route = await routeRepo.findById(parseInt(req.params.id));
            if (!route) return res.status(404).json({ error: 'Route not found' });

            const rules = await ruleRepo.findByRouteId(route.id);
            res.json({ ...route.toJSON(), rules: rules.map(r => r.toJSON()) });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch route' });
        }
    }

    async create(req, res) {
        try {
            const groupId = parseInt(req.params.groupId);
            const group = await groupRepo.findById(groupId);
            if (!group) return res.status(404).json({ error: 'Group not found' });

            const { name, method, path_pattern, capture_requests } = req.body;
            const errors = Route.validate({ method, path_pattern: path_pattern || '', group_id: groupId });
            if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

            const route = await routeRepo.create({ group_id: groupId, name: name || '', method, path_pattern, capture_requests });

            // Create default rule
            await ruleRepo.create(Rule.createDefault(route.id).toDatabaseFormat());

            socketService.broadcastMessage('routeCreated', { groupId, route: route.toJSON() });
            res.status(201).json(route.toJSON());
        } catch (error) {
            res.status(500).json({ error: 'Failed to create route' });
        }
    }

    async update(req, res) {
        try {
            const id = parseInt(req.params.id);
            const route = await routeRepo.findById(id);
            if (!route) return res.status(404).json({ error: 'Route not found' });

            const data = {};
            if (req.body.name !== undefined) data.name = req.body.name;
            if (req.body.method !== undefined) data.method = req.body.method;
            if (req.body.path_pattern !== undefined) data.path_pattern = req.body.path_pattern;
            if (req.body.capture_requests !== undefined) data.capture_requests = req.body.capture_requests;
            if (req.body.group_id !== undefined) data.group_id = req.body.group_id;

            const updated = await routeRepo.update(id, data);
            socketService.broadcastMessage('routeUpdated', updated.toJSON());
            res.json(updated.toJSON());
        } catch (error) {
            res.status(500).json({ error: 'Failed to update route' });
        }
    }

    async delete(req, res) {
        try {
            const id = parseInt(req.params.id);
            const route = await routeRepo.findById(id);
            if (!route) return res.status(404).json({ error: 'Route not found' });

            await routeRepo.delete(id);
            socketService.broadcastMessage('routeDeleted', { id, groupId: route.groupId });
            res.json({ message: 'Route deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete route' });
        }
    }

    async copyTo(req, res) {
        try {
            const routeId = parseInt(req.params.id);
            const route = await routeRepo.findById(routeId);
            if (!route) return res.status(404).json({ error: 'Route not found' });

            const { target_group_id, conflict_strategy } = req.body;
            if (!target_group_id) return res.status(400).json({ error: 'target_group_id is required' });

            const targetGroup = await groupRepo.findById(parseInt(target_group_id));
            if (!targetGroup) return res.status(404).json({ error: 'Target group not found' });

            // Check conflict: route with same method + pathPattern in target group
            const existingRoutes = await routeRepo.findByGroupId(targetGroup.id);
            const conflictRoute = existingRoutes.find(r => r.method === route.method && r.pathPattern === route.pathPattern);

            if (conflictRoute && !conflict_strategy) {
                return res.status(409).json({
                    error: 'conflict',
                    existing: conflictRoute.toJSON(),
                    message: `Route "${route.method} ${route.pathPattern || '/'}" already exists in group "${targetGroup.name}"`
                });
            }

            let targetRoute;
            if (conflictRoute && conflict_strategy === 'replace') {
                // Delete existing rules, update route, copy new rules
                const existingRules = await ruleRepo.findByRouteId(conflictRoute.id);
                for (const rule of existingRules) await ruleRepo.delete(rule.id);
                await routeRepo.update(conflictRoute.id, {
                    name: route.name || '', method: route.method,
                    path_pattern: route.pathPattern, capture_requests: route.captureRequests
                });
                targetRoute = await routeRepo.findById(conflictRoute.id);
            } else {
                // Create new route (keep_both or no conflict)
                let name = route.name || '';
                let pathPattern = route.pathPattern;
                if (conflictRoute) {
                    name = name ? name + ' (copy)' : '';
                    let counter = 1;
                    while (existingRoutes.find(r => r.method === route.method && r.pathPattern === pathPattern)) {
                        pathPattern = (route.pathPattern || '') + '-' + counter;
                        counter++;
                    }
                }
                targetRoute = await routeRepo.create({
                    group_id: targetGroup.id, name,
                    method: route.method, path_pattern: pathPattern,
                    capture_requests: route.captureRequests, slug: route.slug
                });
            }

            // Copy rules
            const rules = await ruleRepo.findByRouteId(route.id);
            for (const rule of rules) {
                await ruleRepo.create({
                    route_id: targetRoute.id, name: rule.name || '',
                    priority: rule.priority, conditions: rule.conditions || [],
                    status_code: rule.statusCode, content_type: rule.contentType,
                    body: rule.body, delay: rule.delay,
                    webhook_url: rule.webhookUrl || null, webhook_method: rule.webhookMethod || 'POST',
                    webhook_headers: rule.webhookHeaders || {}, webhook_body: rule.webhookBody || null,
                    webhook_delay: rule.webhookDelay || 0,
                    webhook_content_type: rule.webhookContentType || 'application/json',
                    webhook_enabled: rule.webhookEnabled !== undefined ? rule.webhookEnabled : true
                });
            }

            socketService.broadcastMessage('routeCreated', { groupId: targetGroup.id, route: targetRoute.toJSON() });
            res.status(201).json(targetRoute.toJSON());
        } catch (error) {
            console.error('Copy route failed:', error);
            res.status(500).json({ error: 'Failed to copy route' });
        }
    }
}

module.exports = new RouteController();
