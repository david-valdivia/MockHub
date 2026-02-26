const serverRepo = require('../repositories/serverRepository');
const Server = require('../models/server');
const githubSyncService = require('../services/githubSyncService');
const socketService = require('../services/socketService');

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
            const env = await githubSyncService.importPulledEnvironment(importData);

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
}

module.exports = new ServerController();
