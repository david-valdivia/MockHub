const Group = require('../models/group');
const database = require('../config/database');

class GroupRepository {
    async findByEnvironmentId(environmentId) {
        const db = database.getConnection();
        const rows = await db.all(
            'SELECT * FROM groups WHERE environment_id = ? ORDER BY sort_order ASC, created_at ASC',
            environmentId
        );
        return rows.map(row => Group.fromDatabase(row));
    }

    async findById(id) {
        const db = database.getConnection();
        const row = await db.get('SELECT * FROM groups WHERE id = ?', id);
        return row ? Group.fromDatabase(row) : null;
    }

    async create(data) {
        const db = database.getConnection();
        const slug = data.slug || this._slugify(data.name);
        const path = data.path || '';
        const result = await db.run(
            'INSERT INTO groups (environment_id, name, sort_order, slug, path, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [data.environment_id, data.name, data.sort_order || 0, slug, path]
        );
        return this.findById(result.lastID);
    }

    async update(id, data) {
        const db = database.getConnection();
        const setClauses = [];
        const values = [];
        if (data.name !== undefined) { setClauses.push('name = ?'); values.push(data.name); }
        if (data.sort_order !== undefined) { setClauses.push('sort_order = ?'); values.push(data.sort_order); }
        if (data.slug !== undefined) { setClauses.push('slug = ?'); values.push(data.slug); }
        if (data.path !== undefined) { setClauses.push('path = ?'); values.push(data.path); }
        if (setClauses.length === 0) throw new Error('No fields to update');
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await db.run(`UPDATE groups SET ${setClauses.join(', ')} WHERE id = ?`, values);
        return this.findById(id);
    }

    _slugify(name) {
        return (name || '').toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
    }

    async delete(id) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM groups WHERE id = ?', id);
        return result.changes > 0;
    }
}

module.exports = new GroupRepository();
