const Rule = require('../models/rule');
const database = require('../config/database');

class RuleRepository {
    async findByRouteId(routeId) {
        const db = database.getConnection();
        const rows = await db.all(
            'SELECT * FROM rules WHERE route_id = ? ORDER BY priority ASC',
            routeId
        );
        return rows.map(row => Rule.fromDatabase(row));
    }

    async findById(id) {
        const db = database.getConnection();
        const row = await db.get('SELECT * FROM rules WHERE id = ?', id);
        return row ? Rule.fromDatabase(row) : null;
    }

    async create(data) {
        const db = database.getConnection();
        const result = await db.run(
            'INSERT INTO rules (route_id, priority, conditions, status_code, content_type, body, delay) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [data.route_id, data.priority || 0, typeof data.conditions === 'string' ? data.conditions : JSON.stringify(data.conditions || []), data.status_code || 200, data.content_type || 'application/json', data.body || '{"message":"OK"}', data.delay || 0]
        );
        return this.findById(result.lastID);
    }

    async update(id, data) {
        const db = database.getConnection();
        const setClauses = [];
        const values = [];
        if (data.priority !== undefined) { setClauses.push('priority = ?'); values.push(data.priority); }
        if (data.conditions !== undefined) { setClauses.push('conditions = ?'); values.push(typeof data.conditions === 'string' ? data.conditions : JSON.stringify(data.conditions)); }
        if (data.status_code !== undefined) { setClauses.push('status_code = ?'); values.push(data.status_code); }
        if (data.content_type !== undefined) { setClauses.push('content_type = ?'); values.push(data.content_type); }
        if (data.body !== undefined) { setClauses.push('body = ?'); values.push(data.body); }
        if (data.delay !== undefined) { setClauses.push('delay = ?'); values.push(data.delay); }
        if (setClauses.length === 0) throw new Error('No fields to update');
        values.push(id);
        await db.run(`UPDATE rules SET ${setClauses.join(', ')} WHERE id = ?`, values);
        return this.findById(id);
    }

    async delete(id) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM rules WHERE id = ?', id);
        return result.changes > 0;
    }

    async deleteByRouteId(routeId) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM rules WHERE route_id = ?', routeId);
        return result.changes;
    }
}

module.exports = new RuleRepository();
