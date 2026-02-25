const environmentRepo = require('../repositories/environmentRepository');
const groupRepo = require('../repositories/groupRepository');
const routeRepo = require('../repositories/routeRepository');
const ruleRepo = require('../repositories/ruleRepository');
const Environment = require('../models/environment');
const socketService = require('../services/socketService');

class ExportImportController {
    async exportEnvironment(req, res) {
        try {
            const envId = parseInt(req.params.id);
            const env = await environmentRepo.findById(envId);
            if (!env) return res.status(404).json({ error: 'Environment not found' });

            const groups = await groupRepo.findByEnvironmentId(env.id);
            const exportData = {
                mockhub_version: '1.0',
                exported_at: new Date().toISOString(),
                environment: {
                    name: env.name,
                    base_path: env.basePath,
                    description: env.description,
                    groups: []
                }
            };

            for (const group of groups) {
                const routes = await routeRepo.findByGroupId(group.id);
                const groupData = { name: group.name, sort_order: group.sortOrder, routes: [] };

                for (const route of routes) {
                    const rules = await ruleRepo.findByRouteId(route.id);
                    groupData.routes.push({
                        method: route.method,
                        path_pattern: route.pathPattern,
                        capture_requests: route.captureRequests,
                        rules: rules.map(r => ({
                            priority: r.priority,
                            conditions: r.conditions,
                            response: {
                                status_code: r.statusCode,
                                content_type: r.contentType,
                                body: r.body,
                                delay: r.delay
                            }
                        }))
                    });
                }

                exportData.environment.groups.push(groupData);
            }

            res.setHeader('Content-Disposition', `attachment; filename="${env.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-mock.json"`);
            res.json(exportData);
        } catch (error) {
            res.status(500).json({ error: 'Failed to export environment' });
        }
    }

    async importEnvironment(req, res) {
        try {
            const importData = req.body;

            if (!importData.mockhub_version || !importData.environment) {
                return res.status(400).json({ error: 'Invalid MockHub export file' });
            }

            const envData = importData.environment;
            let basePath = Environment.sanitizeBasePath(envData.base_path);

            let counter = 1;
            while (await environmentRepo.exists(basePath)) {
                basePath = Environment.sanitizeBasePath(envData.base_path) + '-' + counter;
                counter++;
            }

            const env = await environmentRepo.create({
                name: envData.name,
                base_path: basePath,
                description: envData.description || ''
            });

            for (const groupData of (envData.groups || [])) {
                const group = await groupRepo.create({
                    environment_id: env.id,
                    name: groupData.name,
                    sort_order: groupData.sort_order || 0
                });

                for (const routeData of (groupData.routes || [])) {
                    const route = await routeRepo.create({
                        group_id: group.id,
                        method: routeData.method || 'ALL',
                        path_pattern: routeData.path_pattern,
                        capture_requests: routeData.capture_requests !== undefined ? routeData.capture_requests : true
                    });

                    for (const ruleData of (routeData.rules || [])) {
                        await ruleRepo.create({
                            route_id: route.id,
                            priority: ruleData.priority || 0,
                            conditions: ruleData.conditions || [],
                            status_code: ruleData.response?.status_code || 200,
                            content_type: ruleData.response?.content_type || 'application/json',
                            body: ruleData.response?.body || '{"message":"OK"}',
                            delay: ruleData.response?.delay || 0
                        });
                    }
                }
            }

            socketService.broadcastMessage('environmentCreated', env.toJSON());
            res.status(201).json(env.toJSON());
        } catch (error) {
            console.error('Import error:', error);
            res.status(500).json({ error: 'Failed to import environment' });
        }
    }
}

module.exports = new ExportImportController();
