const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

class Database {
    constructor() {
        this.db = null;
    }

    async initialize() {
        try {
            this.db = await open({
                filename: './webhooks.db',
                driver: sqlite3.Database
            });

            await this.createTables();
            console.log('Database initialized successfully');
            return this.db;
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    async createTables() {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS endpoints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint_id INTEGER NOT NULL,
                response_type TEXT DEFAULT 'custom',
                status_code INTEGER DEFAULT 200,
                content_type TEXT DEFAULT 'application/json',
                body TEXT,
                delay INTEGER DEFAULT 0,
                target_url TEXT,
                preserve_headers BOOLEAN DEFAULT 1,
                FOREIGN KEY (endpoint_id) REFERENCES endpoints (id) ON DELETE CASCADE
            );
            
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint_id INTEGER NOT NULL,
                method TEXT NOT NULL,
                headers TEXT NOT NULL,
                query_params TEXT,
                body TEXT,
                response_type TEXT DEFAULT 'custom',
                response_details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (endpoint_id) REFERENCES endpoints (id) ON DELETE CASCADE
            );
        `);

        // New MockHub tables
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS environments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_path TEXT UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                environment_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (environment_id) REFERENCES environments (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS routes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                method TEXT NOT NULL DEFAULT 'ALL',
                path_pattern TEXT NOT NULL,
                capture_requests INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                route_id INTEGER NOT NULL,
                priority INTEGER DEFAULT 0,
                conditions TEXT DEFAULT '[]',
                status_code INTEGER DEFAULT 200,
                content_type TEXT DEFAULT 'application/json',
                body TEXT DEFAULT '{"message":"OK"}',
                delay INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS request_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                route_id INTEGER NOT NULL,
                environment_id INTEGER NOT NULL,
                method TEXT NOT NULL,
                path TEXT NOT NULL,
                headers TEXT NOT NULL,
                query_params TEXT,
                body TEXT,
                matched_rule_id INTEGER,
                response_status INTEGER,
                response_body TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE,
                FOREIGN KEY (environment_id) REFERENCES environments (id) ON DELETE CASCADE
            );
        `);

        // Migrate existing tables to add new columns
        await this.migrateResponsesTable();
        await this.migrateRequestsTable();
    }

    async migrateResponsesTable() {
        try {
            // Check if new columns exist
            const tableInfo = await this.db.all('PRAGMA table_info(responses)');
            const columnNames = tableInfo.map(col => col.name);

            // Add missing columns
            const columnsToAdd = [
                { name: 'response_type', type: 'TEXT DEFAULT "custom"' },
                { name: 'target_url', type: 'TEXT' },
                { name: 'preserve_headers', type: 'BOOLEAN DEFAULT 1' }
            ];

            for (const column of columnsToAdd) {
                if (!columnNames.includes(column.name)) {
                    console.log(`Adding column ${column.name} to responses table`);
                    await this.db.exec(`ALTER TABLE responses ADD COLUMN ${column.name} ${column.type}`);
                }
            }
        } catch (error) {
            console.error('Migration error:', error);
            // Non-fatal error - continue with app initialization
        }
    }

    async migrateRequestsTable() {
        try {
            // Check if new columns exist
            const tableInfo = await this.db.all('PRAGMA table_info(requests)');
            const columnNames = tableInfo.map(col => col.name);

            // Add missing columns
            const columnsToAdd = [
                { name: 'response_type', type: 'TEXT DEFAULT "custom"' },
                { name: 'response_details', type: 'TEXT' }
            ];

            for (const column of columnsToAdd) {
                if (!columnNames.includes(column.name)) {
                    console.log(`Adding column ${column.name} to requests table`);
                    await this.db.exec(`ALTER TABLE requests ADD COLUMN ${column.name} ${column.type}`);
                }
            }
        } catch (error) {
            console.error('Migration error:', error);
            // Non-fatal error - continue with app initialization
        }
    }

    getConnection() {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }
}

module.exports = new Database();