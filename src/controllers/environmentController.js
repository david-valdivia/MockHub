const environmentRepo = require('../repositories/environmentRepository');
const groupRepo = require('../repositories/groupRepository');
const routeRepo = require('../repositories/routeRepository');
const ruleRepo = require('../repositories/ruleRepository');
const Environment = require('../models/environment');
const socketService = require('../services/socketService');

class EnvironmentController {
    async getAll(req, res) {
        try {
            const envs = await environmentRepo.findAll();
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
            const { name, base_path, description } = req.body;
            const sanitizedPath = Environment.sanitizeBasePath(base_path || '');
            const errors = Environment.validate({ name, base_path: sanitizedPath });
            if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

            const exists = await environmentRepo.exists(sanitizedPath);
            if (exists) return res.status(409).json({ error: 'Base path already in use' });

            const env = await environmentRepo.create({ name, base_path: sanitizedPath, description });
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
