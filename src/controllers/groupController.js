const groupRepo = require('../repositories/groupRepository');
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

            const { name, sort_order } = req.body;
            const errors = Group.validate({ name, environment_id: envId });
            if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

            const group = await groupRepo.create({ environment_id: envId, name, sort_order });
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
}

module.exports = new GroupController();
