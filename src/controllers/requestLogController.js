const requestLogRepo = require('../repositories/requestLogRepository');

class RequestLogController {
    async getByRoute(req, res) {
        try {
            const routeId = parseInt(req.params.routeId);
            const logs = await requestLogRepo.findByRouteId(routeId);
            res.json(logs.map(l => l.toJSON()));
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch request logs' });
        }
    }

    async getByEnvironment(req, res) {
        try {
            const envId = parseInt(req.params.envId);
            const logs = await requestLogRepo.findByEnvironmentId(envId);
            res.json(logs.map(l => l.toJSON()));
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch request logs' });
        }
    }

    async delete(req, res) {
        try {
            const id = parseInt(req.params.id);
            const deleted = await requestLogRepo.delete(id);
            if (!deleted) return res.status(404).json({ error: 'Request log not found' });
            res.json({ message: 'Request log deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete request log' });
        }
    }

    async clearByRoute(req, res) {
        try {
            const routeId = parseInt(req.params.routeId);
            const count = await requestLogRepo.deleteByRouteId(routeId);
            res.json({ message: 'Request logs cleared', deletedCount: count });
        } catch (error) {
            res.status(500).json({ error: 'Failed to clear request logs' });
        }
    }

    async clearByEnvironment(req, res) {
        try {
            const envId = parseInt(req.params.envId);
            const count = await requestLogRepo.deleteByEnvironmentId(envId);
            res.json({ message: 'Request logs cleared', deletedCount: count });
        } catch (error) {
            res.status(500).json({ error: 'Failed to clear request logs' });
        }
    }
}

module.exports = new RequestLogController();
