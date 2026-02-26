const Server = require('../models/server');
const database = require('../config/database');

class ServerRepository {
    async findAll() {
        const db = database.getConnection();
        const rows = await db.all('SELECT * FROM servers ORDER BY created_at DESC');
        return rows.map(row => Server.fromDatabase(row));
    }

    async findById(id) {
        const db = database.getConnection();
        const row = await db.get('SELECT * FROM servers WHERE id = ?', id);
        return row ? Server.fromDatabase(row) : null;
    }

    async findByIdWithToken(id) {
        const db = database.getConnection();
        const row = await db.get('SELECT * FROM servers WHERE id = ?', id);
        if (!row) return null;
        // Return raw row so token is accessible
        return row;
    }

    async create(data) {
        const db = database.getConnection();
        const result = await db.run(
            'INSERT INTO servers (name, type, repo_url, token, branch, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [data.name, data.type || 'github', data.repo_url, data.token, data.branch || 'main', data.is_active ? 1 : 0]
        );
        return this.findById(result.lastID);
    }

    async update(id, data) {
        const db = database.getConnection();
        const setClauses = [];
        const values = [];
        if (data.name !== undefined) { setClauses.push('name = ?'); values.push(data.name); }
        if (data.repo_url !== undefined) { setClauses.push('repo_url = ?'); values.push(data.repo_url); }
        if (data.token !== undefined) { setClauses.push('token = ?'); values.push(data.token); }
        if (data.branch !== undefined) { setClauses.push('branch = ?'); values.push(data.branch); }
        if (data.is_active !== undefined) { setClauses.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }
        if (data.last_sync !== undefined) { setClauses.push('last_sync = ?'); values.push(data.last_sync); }
        if (setClauses.length === 0) throw new Error('No fields to update');
        values.push(id);
        await db.run(`UPDATE servers SET ${setClauses.join(', ')} WHERE id = ?`, values);
        return this.findById(id);
    }

    async delete(id) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM servers WHERE id = ?', id);
        return result.changes > 0;
    }
}

module.exports = new ServerRepository();
