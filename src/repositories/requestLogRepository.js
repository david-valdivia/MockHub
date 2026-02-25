const RequestLog = require('../models/requestLog');
const database = require('../config/database');

class RequestLogRepository {
    async findByRouteId(routeId) {
        const db = database.getConnection();
        const rows = await db.all(
            'SELECT * FROM request_logs WHERE route_id = ? ORDER BY timestamp DESC',
            routeId
        );
        return rows.map(row => RequestLog.fromDatabase(row));
    }

    async findByEnvironmentId(environmentId) {
        const db = database.getConnection();
        const rows = await db.all(
            'SELECT * FROM request_logs WHERE environment_id = ? ORDER BY timestamp DESC',
            environmentId
        );
        return rows.map(row => RequestLog.fromDatabase(row));
    }

    async findById(id) {
        const db = database.getConnection();
        const row = await db.get('SELECT * FROM request_logs WHERE id = ?', id);
        return row ? RequestLog.fromDatabase(row) : null;
    }

    async create(data) {
        const db = database.getConnection();
        const result = await db.run(
            'INSERT INTO request_logs (route_id, environment_id, method, path, headers, query_params, body, matched_rule_id, response_status, response_body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [data.route_id, data.environment_id, data.method, data.path, data.headers, data.query_params, data.body, data.matched_rule_id, data.response_status, data.response_body]
        );
        return this.findById(result.lastID);
    }

    async delete(id) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM request_logs WHERE id = ?', id);
        return result.changes > 0;
    }

    async deleteByRouteId(routeId) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM request_logs WHERE route_id = ?', routeId);
        return result.changes;
    }

    async deleteByEnvironmentId(environmentId) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM request_logs WHERE environment_id = ?', environmentId);
        return result.changes;
    }

    async countByRouteId(routeId) {
        const db = database.getConnection();
        const row = await db.get('SELECT COUNT(*) as count FROM request_logs WHERE route_id = ?', routeId);
        return row.count;
    }
}

module.exports = new RequestLogRepository();
