const Environment = require('../models/environment');
const database = require('../config/database');

class EnvironmentRepository {
    async findAll() {
        const db = database.getConnection();
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
        const rows = await db.all('SELECT * FROM environments WHERE is_active = 1 ORDER BY length(base_path) DESC');
        return rows.map(row => Environment.fromDatabase(row));
    }

    async create(data) {
        const db = database.getConnection();
        const result = await db.run(
            'INSERT INTO environments (name, base_path, description, is_active) VALUES (?, ?, ?, ?)',
            [data.name, data.base_path, data.description || '', data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1]
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
        if (setClauses.length === 0) throw new Error('No fields to update');
        values.push(id);
        await db.run(`UPDATE environments SET ${setClauses.join(', ')} WHERE id = ?`, values);
        return this.findById(id);
    }

    async delete(id) {
        const db = database.getConnection();
        const result = await db.run('DELETE FROM environments WHERE id = ?', id);
        return result.changes > 0;
    }

    async exists(basePath) {
        const db = database.getConnection();
        const row = await db.get('SELECT 1 FROM environments WHERE base_path = ? LIMIT 1', basePath);
        return !!row;
    }
}

module.exports = new EnvironmentRepository();
