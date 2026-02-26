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

            const { method, path_pattern, capture_requests } = req.body;
            const errors = Route.validate({ method, path_pattern: path_pattern || '', group_id: groupId });
            if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

            const route = await routeRepo.create({ group_id: groupId, method, path_pattern, capture_requests });

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
}

module.exports = new RouteController();
