const groupRepo = require('../repositories/groupRepository');
const routeRepo = require('../repositories/routeRepository');
const ruleRepo = require('../repositories/ruleRepository');
const environmentRepo = require('../repositories/environmentRepository');
const Group = require('../models/group');
const socketService = require('../services/socketService');

class GroupController {
    async getByEnvironment(req, res) {
        try {
            const envId = parseInt(req.params.envId);
            const groups = await groupRepo.findByEnvironmentId(envId);
            res.json(groups.map(g => g.toJSON()));
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch groups' });
        }
    }

    async create(req, res) {
        try {
            const envId = parseInt(req.params.envId);
            const env = await environmentRepo.findById(envId);
            if (!env) return res.status(404).json({ error: 'Environment not found' });

            const { name, sort_order, path } = req.body;
            const errors = Group.validate({ name, environment_id: envId });
            if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

            const group = await groupRepo.create({ environment_id: envId, name, sort_order, path: path || '' });
            socketService.broadcastMessage('groupCreated', { environmentId: envId, group: group.toJSON() });
            res.status(201).json(group.toJSON());
        } catch (error) {
            res.status(500).json({ error: 'Failed to create group' });
        }
    }

    async update(req, res) {
        try {
            const id = parseInt(req.params.id);
            const group = await groupRepo.findById(id);
            if (!group) return res.status(404).json({ error: 'Group not found' });

            const data = {};
            if (req.body.name !== undefined) data.name = req.body.name;
            if (req.body.sort_order !== undefined) data.sort_order = req.body.sort_order;
            if (req.body.path !== undefined) data.path = req.body.path;

            const updated = await groupRepo.update(id, data);
            socketService.broadcastMessage('groupUpdated', updated.toJSON());
            res.json(updated.toJSON());
        } catch (error) {
            res.status(500).json({ error: 'Failed to update group' });
        }
    }

    async delete(req, res) {
        try {
            const id = parseInt(req.params.id);
            const group = await groupRepo.findById(id);
            if (!group) return res.status(404).json({ error: 'Group not found' });

            await groupRepo.delete(id);
            socketService.broadcastMessage('groupDeleted', { id, environmentId: group.environmentId });
            res.json({ message: 'Group deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete group' });
        }
    }

    async copyTo(req, res) {
        try {
            const groupId = parseInt(req.params.id);
            const group = await groupRepo.findById(groupId);
            if (!group) return res.status(404).json({ error: 'Group not found' });

            const { target_environment_id, conflict_strategy } = req.body;
            if (!target_environment_id) return res.status(400).json({ error: 'target_environment_id is required' });

            const targetEnv = await environmentRepo.findById(parseInt(target_environment_id));
            if (!targetEnv) return res.status(404).json({ error: 'Target environment not found' });

            // Check conflict: group with same name in target env
            const existingGroups = await groupRepo.findByEnvironmentId(targetEnv.id);
            const conflictGroup = existingGroups.find(g => g.name === group.name);

            if (conflictGroup && !conflict_strategy) {
                return res.status(409).json({
                    error: 'conflict',
                    existing: conflictGroup.toJSON(),
                    message: `Group "${group.name}" already exists in "${targetEnv.name}"`
                });
            }

            let targetGroup;
            if (conflictGroup && conflict_strategy === 'replace') {
                // Delete existing routes/rules, then copy new ones
                const existingRoutes = await routeRepo.findByGroupId(conflictGroup.id);
                for (const route of existingRoutes) {
                    const rules = await ruleRepo.findByRouteId(route.id);
                    for (const rule of rules) await ruleRepo.delete(rule.id);
                    await routeRepo.delete(route.id);
                }
                await groupRepo.update(conflictGroup.id, {
                    name: group.name, sort_order: group.sortOrder,
                    slug: group.slug, path: group.path || ''
                });
                targetGroup = await groupRepo.findById(conflictGroup.id);
            } else {
                // Create new group (keep_both or no conflict)
                let name = group.name;
                if (conflictGroup) {
                    let counter = 1;
                    while (existingGroups.find(g => g.name === name)) {
                        name = group.name + ' (' + counter + ')';
                        counter++;
                    }
                }
                targetGroup = await groupRepo.create({
                    environment_id: targetEnv.id, name,
                    sort_order: group.sortOrder, slug: group.slug, path: group.path || ''
                });
            }

            // Copy routes and rules
            const routes = await routeRepo.findByGroupId(group.id);
            for (const route of routes) {
                const rules = await ruleRepo.findByRouteId(route.id);
                const newRoute = await routeRepo.create({
                    group_id: targetGroup.id, name: route.name || '',
                    method: route.method, path_pattern: route.pathPattern,
                    capture_requests: route.captureRequests, slug: route.slug
                });
                for (const rule of rules) {
                    await ruleRepo.create({
                        route_id: newRoute.id, name: rule.name || '',
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
            }

            socketService.broadcastMessage('groupCreated', { environmentId: targetEnv.id, group: targetGroup.toJSON() });
            res.status(201).json(targetGroup.toJSON());
        } catch (error) {
            console.error('Copy group failed:', error);
            res.status(500).json({ error: 'Failed to copy group' });
        }
    }
}

module.exports = new GroupController();
