const Route = require('../models/route');
const database = require('../config/database');

class RouteRepository {
    async findByGroupId(groupId) {
        const db = database.getConnection();
        const rows = await db.all(
            'SELECT * FROM routes WHERE group_id = ? ORDER BY created_at ASC',
            groupId
        );
        return rows.map(row => Route.fromDatabase(row));
    }

    async findByEnvironmentId(environmentId) {
        const db = database.getConnection();
        const rows = await db.all(`
            SELECT r.* FROM routes r
            JOIN groups g ON r.group_id = g.id
            WHERE g.environment_id = ?
            ORDER BY g.sort_order ASC, r.created_at ASC
        `, environmentId);
        return rows.map(row => Route.fromDatabase(row));
    }

    async findById(id) {
        const db = database.getConnection();
        const row = await db.get('SELECT * FROM routes WHERE id = ?', id);
        return row ? Route.fromDatabase(row) : null;
    }

    async create(data) {
        const db = database.getConnection();
        const pathPattern = data.path_pattern || '';
        const slug = data.slug || this._slugify(pathPattern || data.name || 'route');
        const name = data.name || '';
        const result = await db.run(
            'INSERT INTO routes (group_id, name, method, path_pattern, capture_requests, slug, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [data.group_id, name, (data.method || 'ALL').toUpperCase(), pathPattern, data.capture_requests !== undefined ? (data.capture_requests ? 1 : 0) : 1, slug]
        );
        return this.findById(result.lastID);
    }

    async update(id, data) {
        const db = database.getConnection();
        const setClauses = [];
        const values = [];
        if (data.name !== undefined) { setClauses.push('name = ?'); values.push(data.name); }
        if (data.method !== undefined) { setClauses.push('method = ?'); values.push(data.method.toUpperCase()); }
        if (data.path_pattern !== undefined) { setClauses.push('path_pattern = ?'); values.push(data.path_pattern); }
        if (data.capture_requests !== undefined) { setClauses.push('capture_requests = ?'); values.push(data.capture_requests ? 1 : 0); }
        if (data.group_id !== undefined) { setClauses.push('group_id = ?'); values.push(data.group_id); }
        if (data.slug !== undefined) { setClauses.push('slug = ?'); values.push(data.slug); }
        if (setClauses.length === 0) throw new Error('No fields to update');
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await db.run(`UPDATE routes SET ${setClauses.join(', ')} WHERE id = ?`, values);
        return this.findById(id);
    }

    _slugify(name) {
        return (name || '').toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
    }

    async delete(id) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM routes WHERE id = ?', id);
        return result.changes > 0;
    }
}

module.exports = new RouteRepository();
