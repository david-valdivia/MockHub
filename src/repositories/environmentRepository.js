const Environment = require('../models/environment');
const database = require('../config/database');
const activeServerService = require('../services/activeServerService');

class EnvironmentRepository {
    async findAll(serverId = undefined) {
        const db = database.getConnection();
        if (serverId === null) {
            // Explicitly local: server_id IS NULL
            const rows = await db.all('SELECT * FROM environments WHERE server_id IS NULL ORDER BY created_at DESC');
            return rows.map(row => Environment.fromDatabase(row));
        } else if (serverId !== undefined) {
            const rows = await db.all('SELECT * FROM environments WHERE server_id = ? ORDER BY created_at DESC', [serverId]);
            return rows.map(row => Environment.fromDatabase(row));
        }
        // No filter — all environments
        const rows = await db.all('SELECT * FROM environments ORDER BY created_at DESC');
        return rows.map(row => Environment.fromDatabase(row));
    }

    async findById(id) {
        const db = database.getConnection();
        const row = await db.get('SELECT * FROM environments WHERE id = ?', id);
        return row ? Environment.fromDatabase(row) : null;
    }

    async findByBasePath(basePath) {
        const db = database.getConnection();
        const row = await db.get('SELECT * FROM environments WHERE base_path = ?', basePath);
        return row ? Environment.fromDatabase(row) : null;
    }

    async findAllActive() {
        const db = database.getConnection();
        const serverId = activeServerService.get();
        let rows;
        if (serverId === null) {
            rows = await db.all('SELECT * FROM environments WHERE is_active = 1 AND server_id IS NULL ORDER BY length(base_path) DESC');
        } else {
            rows = await db.all('SELECT * FROM environments WHERE is_active = 1 AND server_id = ? ORDER BY length(base_path) DESC', [serverId]);
        }
        return rows.map(row => Environment.fromDatabase(row));
    }

    async findAllActiveForRouting() {
        const db = database.getConnection();
        const rows = await db.all('SELECT * FROM environments WHERE is_active = 1 ORDER BY length(base_path) DESC');
        return rows.map(row => Environment.fromDatabase(row));
    }

    async create(data) {
        const db = database.getConnection();
        const slug = data.slug || this._slugify(data.name);
        const serverId = data.server_id !== undefined ? data.server_id : null;
        const result = await db.run(
            'INSERT INTO environments (name, base_path, description, is_active, slug, server_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [data.name, data.base_path, data.description || '', data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, slug, serverId]
        );
        return this.findById(result.lastID);
    }

    async update(id, data) {
        const db = database.getConnection();
        const setClauses = [];
        const values = [];
        if (data.name !== undefined) { setClauses.push('name = ?'); values.push(data.name); }
        if (data.base_path !== undefined) { setClauses.push('base_path = ?'); values.push(data.base_path); }
        if (data.description !== undefined) { setClauses.push('description = ?'); values.push(data.description); }
        if (data.is_active !== undefined) { setClauses.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }
        if (data.slug !== undefined) { setClauses.push('slug = ?'); values.push(data.slug); }
        if (data.server_id !== undefined) { setClauses.push('server_id = ?'); values.push(data.server_id); }
        if (setClauses.length === 0) throw new Error('No fields to update');
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await db.run(`UPDATE environments SET ${setClauses.join(', ')} WHERE id = ?`, values);
        return this.findById(id);
    }

    _slugify(name) {
        return (name || '').toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
    }

    async delete(id) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM environments WHERE id = ?', id);
        return result.changes > 0;
    }

    async exists(basePath, serverId = undefined) {
        const db = database.getConnection();
        if (serverId === null) {
            const row = await db.get('SELECT 1 FROM environments WHERE base_path = ? AND server_id IS NULL LIMIT 1', basePath);
            return !!row;
        } else if (serverId !== undefined) {
            const row = await db.get('SELECT 1 FROM environments WHERE base_path = ? AND server_id = ? LIMIT 1', [basePath, serverId]);
            return !!row;
        }
        const row = await db.get('SELECT 1 FROM environments WHERE base_path = ? LIMIT 1', basePath);
        return !!row;
    }
}

module.exports = new EnvironmentRepository();
