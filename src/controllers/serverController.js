const serverRepo = require('../repositories/serverRepository');
const syncTrackingRepo = require('../repositories/syncTrackingRepository');
const Server = require('../models/server');
const githubSyncService = require('../services/githubSyncService');
const contentHashService = require('../services/contentHashService');
const socketService = require('../services/socketService');
const environmentRepo = require('../repositories/environmentRepository');
const groupRepo = require('../repositories/groupRepository');
const routeRepo = require('../repositories/routeRepository');
const ruleRepo = require('../repositories/ruleRepository');

class ServerController {
    async getAll(req, res) {
        try {
            const servers = await serverRepo.findAll();
            res.json(servers.map(s => s.toJSON()));
        } catch (error) {
            console.error('Failed to get servers:', error);
            res.status(500).json({ error: 'Failed to get servers' });
        }
    }

    async create(req, res) {
        try {
            const data = req.body;
            const errors = Server.validate(data);
            if (errors.length > 0) {
                return res.status(400).json({ error: errors.join(', ') });
            }

            const server = await serverRepo.create(data);
            res.status(201).json(server.toJSON());
        } catch (error) {
            console.error('Failed to create server:', error);
            res.status(500).json({ error: 'Failed to create server' });
        }
    }

    async update(req, res) {
        try {
            const id = parseInt(req.params.id);
            const existing = await serverRepo.findById(id);
            if (!existing) return res.status(404).json({ error: 'Server not found' });

            const server = await serverRepo.update(id, req.body);
            res.json(server.toJSON());
        } catch (error) {
            console.error('Failed to update server:', error);
            res.status(500).json({ error: 'Failed to update server' });
        }
    }

    async delete(req, res) {
        try {
            const id = parseInt(req.params.id);
            const deleted = await serverRepo.delete(id);
            if (!deleted) return res.status(404).json({ error: 'Server not found' });
            res.json({ success: true });
        } catch (error) {
            console.error('Failed to delete server:', error);
            res.status(500).json({ error: 'Failed to delete server' });
        }
    }

    async testConnection(req, res) {
        try {
            const id = parseInt(req.params.id);
            const serverRow = await serverRepo.findByIdWithToken(id);
            if (!serverRow) return res.status(404).json({ error: 'Server not found' });

            const result = await githubSyncService.testConnection(serverRow);
            res.json(result);
        } catch (error) {
            console.error('Connection test failed:', error);
            res.status(400).json({ error: error.message || 'Connection test failed' });
        }
    }

    async listRemoteEnvironments(req, res) {
        try {
            const id = parseInt(req.params.id);
            const serverRow = await serverRepo.findByIdWithToken(id);
            if (!serverRow) return res.status(404).json({ error: 'Server not found' });

            const environments = await githubSyncService.listRemoteEnvironments(serverRow);
            res.json(environments);
        } catch (error) {
            console.error('Failed to list remote environments:', error);
            res.status(500).json({ error: error.message || 'Failed to list remote environments' });
        }
    }

    async pull(req, res) {
        try {
            const id = parseInt(req.params.id);
            const serverRow = await serverRepo.findByIdWithToken(id);
            if (!serverRow) return res.status(404).json({ error: 'Server not found' });

            const { envSlug } = req.body;
            if (!envSlug) return res.status(400).json({ error: 'envSlug is required' });

            const importData = await githubSyncService.pullEnvironment(serverRow, envSlug);
            const env = await githubSyncService.importPulledEnvironment(importData, id);

            // Record sync tracking hashes (same as push) so sync status is accurate
            const envHash = await contentHashService.envHash(env.id);
            await syncTrackingRepo.recordPush(id, 'environment', env.id, envHash);

            const groups = await groupRepo.findByEnvironmentId(env.id);
            for (const group of groups) {
                const groupHash = await contentHashService.groupHash(group.id);
                await syncTrackingRepo.recordPush(id, 'group', group.id, groupHash);
                const routes = await routeRepo.findByGroupId(group.id);
                for (const route of routes) {
                    const routeHash = await contentHashService.routeWithRulesHash(route.id);
                    await syncTrackingRepo.recordPush(id, 'route', route.id, routeHash);
                    const rules = await ruleRepo.findByRouteId(route.id);
                    for (const rule of rules) {
                        const ruleHash = contentHashService.hash(contentHashService.ruleContent(rule));
                        await syncTrackingRepo.recordPush(id, 'rule', rule.id, ruleHash);
                    }
                }
            }

            // Write _metadata.json to GitHub so repo always reflects current state
            const metadata = await contentHashService.buildEnvironmentMetadata(env.id);
            await githubSyncService.writeMetadata(serverRow, env, metadata);

            // Update last_sync
            await serverRepo.update(id, { last_sync: new Date().toISOString() });

            socketService.broadcastMessage('environmentCreated', env.toJSON());
            res.json(env.toJSON());
        } catch (error) {
            console.error('Pull failed:', error);
            res.status(500).json({ error: error.message || 'Pull failed' });
        }
    }

    async push(req, res) {
        try {
            const id = parseInt(req.params.id);
            const serverRow = await serverRepo.findByIdWithToken(id);
            if (!serverRow) return res.status(404).json({ error: 'Server not found' });

            const { envId } = req.body;
            if (!envId) return res.status(400).json({ error: 'envId is required' });

            const result = await githubSyncService.pushEnvironment(serverRow, envId);
            res.json(result);
        } catch (error) {
            console.error('Push failed:', error);
            res.status(500).json({ error: error.message || 'Push failed' });
        }
    }

    async pushGroup(req, res) {
        try {
            const id = parseInt(req.params.id);
            const serverRow = await serverRepo.findByIdWithToken(id);
            if (!serverRow) return res.status(404).json({ error: 'Server not found' });

            const { groupId } = req.body;
            if (!groupId) return res.status(400).json({ error: 'groupId is required' });

            const result = await githubSyncService.pushGroup(serverRow, groupId);
            res.json(result);
        } catch (error) {
            console.error('Push group failed:', error);
            res.status(500).json({ error: error.message || 'Push group failed' });
        }
    }

    async pushRoute(req, res) {
        try {
            const id = parseInt(req.params.id);
            const serverRow = await serverRepo.findByIdWithToken(id);
            if (!serverRow) return res.status(404).json({ error: 'Server not found' });

            const { routeId } = req.body;
            if (!routeId) return res.status(400).json({ error: 'routeId is required' });

            const result = await githubSyncService.pushRoute(serverRow, routeId);
            res.json(result);
        } catch (error) {
            console.error('Push route failed:', error);
            res.status(500).json({ error: error.message || 'Push route failed' });
        }
    }

    async getSyncStatus(req, res) {
        try {
            const id = parseInt(req.params.id);
            const server = await serverRepo.findById(id);
            if (!server) return res.status(404).json({ error: 'Server not found' });

            // Compute current local hashes for accurate comparison
            const localHashes = { environment: {}, group: {}, route: {}, rule: {} };
            const envs = await environmentRepo.findAll();
            for (const env of envs) {
                localHashes.environment[env.id] = await contentHashService.envHash(env.id);
                const groups = await groupRepo.findByEnvironmentId(env.id);
                for (const group of groups) {
                    localHashes.group[group.id] = await contentHashService.groupHash(group.id);
                    const routes = await routeRepo.findByGroupId(group.id);
                    for (const route of routes) {
                        localHashes.route[route.id] = await contentHashService.routeWithRulesHash(route.id);
                        const rules = await ruleRepo.findByRouteId(route.id);
                        for (const rule of rules) {
                            localHashes.rule[rule.id] = contentHashService.hash(contentHashService.ruleContent(rule));
                        }
                    }
                }
            }

            const syncMap = await syncTrackingRepo.getEnvironmentSyncMap(id, localHashes);
            res.json(syncMap);
        } catch (error) {
            console.error('Failed to get sync status:', error);
            res.status(500).json({ error: 'Failed to get sync status' });
        }
    }

    async copyEnvironment(req, res) {
        try {
            const sourceId = parseInt(req.params.sourceId);
            const targetId = parseInt(req.params.targetId);
            const { envSlug } = req.body;

            if (!envSlug) return res.status(400).json({ error: 'envSlug is required' });

            const sourceRow = await serverRepo.findByIdWithToken(sourceId);
            if (!sourceRow) return res.status(404).json({ error: 'Source server not found' });

            const targetRow = await serverRepo.findByIdWithToken(targetId);
            if (!targetRow) return res.status(404).json({ error: 'Target server not found' });

            const env = await githubSyncService.copyEnvironment(sourceRow, targetRow, envSlug);
            socketService.broadcastMessage('environmentCreated', env.toJSON());
            res.json(env.toJSON());
        } catch (error) {
            console.error('Copy failed:', error);
            res.status(500).json({ error: error.message || 'Copy between servers failed' });
        }
    }
}

module.exports = new ServerController();
