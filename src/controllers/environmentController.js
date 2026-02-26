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

    // Helper: copy full group/route/rule tree into a target environment
    async _copyTreeInto(sourceEnvId, targetEnvId) {
        const groups = await groupRepo.findByEnvironmentId(sourceEnvId);
        for (const group of groups) {
            const routes = await routeRepo.findByGroupId(group.id);
            const newGroup = await groupRepo.create({
                environment_id: targetEnvId,
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
    }

    // Helper: delete all groups/routes/rules of an environment (but keep the env row)
    async _deleteEnvChildren(envId) {
        const groups = await groupRepo.findByEnvironmentId(envId);
        for (const group of groups) {
            const routes = await routeRepo.findByGroupId(group.id);
            for (const route of routes) {
                const rules = await ruleRepo.findByRouteId(route.id);
                for (const rule of rules) {
                    await ruleRepo.delete(rule.id);
                }
                await routeRepo.delete(route.id);
            }
            await groupRepo.delete(group.id);
        }
    }

    async copyToServer(req, res) {
        try {
            const envId = parseInt(req.params.id);
            const env = await environmentRepo.findById(envId);
            if (!env) return res.status(404).json({ error: 'Environment not found' });

            const targetServerId = req.body.target_server_id === 'local' ? null : parseInt(req.body.target_server_id);
            const conflictStrategy = req.body.conflict_strategy; // 'keep_both' | 'replace' | undefined

            // Check if environment with same basePath already exists on target
            const existingEnvs = await environmentRepo.findAll(targetServerId);
            const conflictEnv = existingEnvs.find(e => e.basePath === env.basePath);

            if (conflictEnv && !conflictStrategy) {
                // No strategy chosen yet — return 409 so frontend can ask the user
                return res.status(409).json({
                    error: 'conflict',
                    existing: conflictEnv.toJSON(),
                    message: `Environment with path "${env.basePath || '/'}" already exists on the target server`
                });
            }

            if (conflictEnv && conflictStrategy === 'replace') {
                // Replace: delete existing children, update env metadata, copy new tree
                await this._deleteEnvChildren(conflictEnv.id);
                await environmentRepo.update(conflictEnv.id, {
                    name: env.name,
                    description: env.description,
                    slug: env.slug
                });
                await this._copyTreeInto(env.id, conflictEnv.id);
                const updated = await environmentRepo.findById(conflictEnv.id);
                socketService.broadcastMessage('environmentUpdated', updated.toJSON());
                return res.status(200).json(updated.toJSON());
            }

            // keep_both or no conflict: create new env (append suffix if needed)
            let basePath = env.basePath;
            if (conflictEnv) {
                let counter = 1;
                while (await environmentRepo.exists(basePath, targetServerId)) {
                    basePath = env.basePath + '-' + counter;
                    counter++;
                }
            }

            const newEnv = await environmentRepo.create({
                name: env.name,
                base_path: basePath,
                description: env.description,
                slug: env.slug,
                server_id: targetServerId
            });

            await this._copyTreeInto(env.id, newEnv.id);
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
