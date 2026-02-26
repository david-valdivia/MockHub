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
            'INSERT INTO rules (route_id, name, priority, conditions, status_code, content_type, body, delay, webhook_url, webhook_method, webhook_headers, webhook_body, webhook_delay, webhook_content_type, webhook_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [data.route_id, data.name || '', data.priority || 0, typeof data.conditions === 'string' ? data.conditions : JSON.stringify(data.conditions || []), data.status_code || 200, data.content_type || 'application/json', data.body || '{"message":"OK"}', data.delay || 0, data.webhook_url || null, data.webhook_method || 'POST', typeof data.webhook_headers === 'string' ? data.webhook_headers : JSON.stringify(data.webhook_headers || {}), data.webhook_body || null, data.webhook_delay || 0, data.webhook_content_type || 'application/json', data.webhook_enabled !== undefined ? (data.webhook_enabled ? 1 : 0) : 1]
        );
        return this.findById(result.lastID);
    }

    async update(id, data) {
        const db = database.getConnection();
        const setClauses = [];
        const values = [];
        if (data.name !== undefined) { setClauses.push('name = ?'); values.push(data.name); }
        if (data.priority !== undefined) { setClauses.push('priority = ?'); values.push(data.priority); }
        if (data.conditions !== undefined) { setClauses.push('conditions = ?'); values.push(typeof data.conditions === 'string' ? data.conditions : JSON.stringify(data.conditions)); }
        if (data.status_code !== undefined) { setClauses.push('status_code = ?'); values.push(data.status_code); }
        if (data.content_type !== undefined) { setClauses.push('content_type = ?'); values.push(data.content_type); }
        if (data.body !== undefined) { setClauses.push('body = ?'); values.push(data.body); }
        if (data.delay !== undefined) { setClauses.push('delay = ?'); values.push(data.delay); }
        if (data.webhook_url !== undefined) { setClauses.push('webhook_url = ?'); values.push(data.webhook_url || null); }
        if (data.webhook_method !== undefined) { setClauses.push('webhook_method = ?'); values.push(data.webhook_method); }
        if (data.webhook_headers !== undefined) { setClauses.push('webhook_headers = ?'); values.push(typeof data.webhook_headers === 'string' ? data.webhook_headers : JSON.stringify(data.webhook_headers || {})); }
        if (data.webhook_body !== undefined) { setClauses.push('webhook_body = ?'); values.push(data.webhook_body || null); }
        if (data.webhook_delay !== undefined) { setClauses.push('webhook_delay = ?'); values.push(data.webhook_delay); }
        if (data.webhook_content_type !== undefined) { setClauses.push('webhook_content_type = ?'); values.push(data.webhook_content_type); }
        if (data.webhook_enabled !== undefined) { setClauses.push('webhook_enabled = ?'); values.push(data.webhook_enabled ? 1 : 0); }
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
