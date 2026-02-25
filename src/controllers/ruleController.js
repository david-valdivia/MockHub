const ruleRepo = require('../repositories/ruleRepository');
const routeRepo = require('../repositories/routeRepository');
const Rule = require('../models/rule');
const socketService = require('../services/socketService');

class RuleController {
    async getByRoute(req, res) {
        try {
            const routeId = parseInt(req.params.routeId);
            const rules = await ruleRepo.findByRouteId(routeId);
            res.json(rules.map(r => r.toJSON()));
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch rules' });
        }
    }

    async create(req, res) {
        try {
            const routeId = parseInt(req.params.routeId);
            const route = await routeRepo.findById(routeId);
            if (!route) return res.status(404).json({ error: 'Route not found' });

            const data = { ...req.body, route_id: routeId };
            const errors = Rule.validate(data);
            if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

            const rule = await ruleRepo.create(data);
            socketService.broadcastMessage('ruleCreated', { routeId, rule: rule.toJSON() });
            res.status(201).json(rule.toJSON());
        } catch (error) {
            res.status(500).json({ error: 'Failed to create rule' });
        }
    }

    async update(req, res) {
        try {
            const id = parseInt(req.params.id);
            const rule = await ruleRepo.findById(id);
            if (!rule) return res.status(404).json({ error: 'Rule not found' });

            const updated = await ruleRepo.update(id, req.body);
            socketService.broadcastMessage('ruleUpdated', updated.toJSON());
            res.json(updated.toJSON());
        } catch (error) {
            res.status(500).json({ error: 'Failed to update rule' });
        }
    }

    async delete(req, res) {
        try {
            const id = parseInt(req.params.id);
            const rule = await ruleRepo.findById(id);
            if (!rule) return res.status(404).json({ error: 'Rule not found' });

            await ruleRepo.delete(id);
            socketService.broadcastMessage('ruleDeleted', { id, routeId: rule.routeId });
            res.json({ message: 'Rule deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete rule' });
        }
    }
}

module.exports = new RuleController();
