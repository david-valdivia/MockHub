const environmentRepo = require('../repositories/environmentRepository');
const groupRepo = require('../repositories/groupRepository');
const routeRepo = require('../repositories/routeRepository');
const ruleRepo = require('../repositories/ruleRepository');
const Environment = require('../models/environment');
const socketService = require('../services/socketService');

class EnvironmentController {
    async getAll(req, res) {
        try {
            let serverId = undefined;
            if (req.query.server_id === 'local') {
                serverId = null; // only local environments (server_id IS NULL)
            } else if (req.query.server_id) {
                serverId = parseInt(req.query.server_id);
            }
            const envs = await environmentRepo.findAll(serverId);
            res.json(envs.map(e => e.toJSON()));
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch environments' });
        }
    }

    async getById(req, res) {
        try {
            const env = await environmentRepo.findById(parseInt(req.params.id));
            if (!env) return res.status(404).json({ error: 'Environment not found' });
            res.json(env.toJSON());
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch environment' });
        }
    }

    async create(req, res) {
        try {
            const { name, base_path, description, server_id } = req.body;
            const sanitizedPath = Environment.sanitizeBasePath(base_path || '');
            const errors = Environment.validate({ name, base_path: sanitizedPath });
            if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

            const serverId = server_id ? parseInt(server_id) : null;
            if (sanitizedPath) {
                const exists = await environmentRepo.exists(sanitizedPath, serverId);
                if (exists) return res.status(409).json({ error: 'Base path already in use' });
            }

            const env = await environmentRepo.create({ name, base_path: sanitizedPath, description, server_id: serverId });
            socketService.broadcastMessage('environmentCreated', env.toJSON());
            res.status(201).json(env.toJSON());
        } catch (error) {
            res.status(500).json({ error: 'Failed to create environment' });
        }
    }

    async update(req, res) {
        try {
            const id = parseInt(req.params.id);
            const env = await environmentRepo.findById(id);
            if (!env) return res.status(404).json({ error: 'Environment not found' });

            const data = {};
            if (req.body.name !== undefined) data.name = req.body.name;
            if (req.body.base_path !== undefined) data.base_path = Environment.sanitizeBasePath(req.body.base_path);
            if (req.body.description !== undefined) data.description = req.body.description;
            if (req.body.is_active !== undefined) data.is_active = req.body.is_active;

            const updated = await environmentRepo.update(id, data);
            socketService.broadcastMessage('environmentUpdated', updated.toJSON());
            res.json(updated.toJSON());
        } catch (error) {
            res.status(500).json({ error: 'Failed to update environment' });
        }
    }

    async delete(req, res) {
        try {
            const id = parseInt(req.params.id);
            const env = await environmentRepo.findById(id);
            if (!env) return res.status(404).json({ error: 'Environment not found' });

            await environmentRepo.delete(id);
            socketService.broadcastMessage('environmentDeleted', { id });
            res.json({ message: 'Environment deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete environment' });
        }
    }

    async copyToServer(req, res) {
        try {
            const envId = parseInt(req.params.id);
            const env = await environmentRepo.findById(envId);
            if (!env) return res.status(404).json({ error: 'Environment not found' });

            const targetServerId = req.body.target_server_id === 'local' ? null : parseInt(req.body.target_server_id);

            // Export the full tree
            const groups = await groupRepo.findByEnvironmentId(env.id);
            let basePath = env.basePath;
            let counter = 1;
            while (await environmentRepo.exists(basePath, targetServerId)) {
                basePath = env.basePath + '-' + counter;
                counter++;
            }

            const newEnv = await environmentRepo.create({
                name: env.name,
                base_path: basePath,
                description: env.description,
                slug: env.slug,
                server_id: targetServerId
            });

            for (const group of groups) {
                const routes = await routeRepo.findByGroupId(group.id);
                const newGroup = await groupRepo.create({
                    environment_id: newEnv.id,
                    name: group.name,
                    sort_order: group.sortOrder,
                    slug: group.slug,
                    path: group.path || ''
                });

                for (const route of routes) {
                    const rules = await ruleRepo.findByRouteId(route.id);
                    const newRoute = await routeRepo.create({
                        group_id: newGroup.id,
                        name: route.name || '',
                        method: route.method,
                        path_pattern: route.pathPattern,
                        capture_requests: route.captureRequests,
                        slug: route.slug
                    });

                    for (const rule of rules) {
                        await ruleRepo.create({
                            route_id: newRoute.id,
                            name: rule.name || '',
                            priority: rule.priority,
                            conditions: rule.conditions || [],
                            status_code: rule.statusCode,
                            content_type: rule.contentType,
                            body: rule.body,
                            delay: rule.delay,
                            webhook_url: rule.webhookUrl || null,
                            webhook_method: rule.webhookMethod || 'POST',
                            webhook_headers: rule.webhookHeaders || {},
                            webhook_body: rule.webhookBody || null,
                            webhook_delay: rule.webhookDelay || 0,
                            webhook_content_type: rule.webhookContentType || 'application/json',
                            webhook_enabled: rule.webhookEnabled !== undefined ? rule.webhookEnabled : true
                        });
                    }
                }
            }

            socketService.broadcastMessage('environmentCreated', newEnv.toJSON());
            res.status(201).json(newEnv.toJSON());
        } catch (error) {
            console.error('Copy environment failed:', error);
            res.status(500).json({ error: 'Failed to copy environment' });
        }
    }

    async getFullTree(req, res) {
        try {
            const env = await environmentRepo.findById(parseInt(req.params.id));
            if (!env) return res.status(404).json({ error: 'Environment not found' });

            const groups = await groupRepo.findByEnvironmentId(env.id);
            const tree = { ...env.toJSON(), groups: [] };

            for (const group of groups) {
                const routes = await routeRepo.findByGroupId(group.id);
                const groupData = { ...group.toJSON(), routes: [] };

                for (const route of routes) {
                    const rules = await ruleRepo.findByRouteId(route.id);
                    groupData.routes.push({
                        ...route.toJSON(),
                        rules: rules.map(r => r.toJSON())
                    });
                }

                tree.groups.push(groupData);
            }

            res.json(tree);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch environment tree' });
        }
    }
}

module.exports = new EnvironmentController();
