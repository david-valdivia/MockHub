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
                name TEXT DEFAULT '',
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

        // Servers table for GitHub sync
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'github',
                repo_url TEXT NOT NULL,
                token TEXT NOT NULL,
                branch TEXT DEFAULT 'main',
                is_active INTEGER DEFAULT 0,
                last_sync TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Sync tracking table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS sync_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                pushed_at TIMESTAMP NOT NULL,
                FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE,
                UNIQUE(server_id, entity_type, entity_id)
            );
        `);

        // Migrate existing tables to add new columns
        await this.migrateResponsesTable();
        await this.migrateRequestsTable();
        await this.migrateRulesTable();
        await this.migrateRequestLogsTable();
        await this.migrateSlugColumns();
        await this.migrateUpdatedAtColumns();
        await this.migrateSyncTrackingHash();
        await this.migrateEnvironmentServerId();
        await this.migrateBasePathUnique();
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

    async migrateRulesTable() {
        try {
            const tableInfo = await this.db.all('PRAGMA table_info(rules)');
            const columnNames = tableInfo.map(col => col.name);

            const columnsToAdd = [
                { name: 'name', type: "TEXT DEFAULT ''" },
                { name: 'webhook_url', type: 'TEXT' },
                { name: 'webhook_method', type: "TEXT DEFAULT 'POST'" },
                { name: 'webhook_headers', type: "TEXT DEFAULT '{}'" },
                { name: 'webhook_body', type: 'TEXT' },
                { name: 'webhook_delay', type: 'INTEGER DEFAULT 0' },
                { name: 'webhook_content_type', type: "TEXT DEFAULT 'application/json'" },
                { name: 'webhook_enabled', type: 'INTEGER DEFAULT 1' }
            ];

            for (const col of columnsToAdd) {
                if (!columnNames.includes(col.name)) {
                    console.log(`Adding column ${col.name} to rules table`);
                    await this.db.exec(`ALTER TABLE rules ADD COLUMN ${col.name} ${col.type}`);
                }
            }
        } catch (error) {
            console.error('Rules migration error:', error);
        }
    }

    async migrateRequestLogsTable() {
        try {
            const tableInfo = await this.db.all('PRAGMA table_info(request_logs)');
            const columnNames = tableInfo.map(col => col.name);

            const columnsToAdd = [
                { name: 'webhook_sent', type: 'INTEGER DEFAULT 0' },
                { name: 'webhook_url', type: 'TEXT' },
                { name: 'webhook_method', type: 'TEXT' },
                { name: 'webhook_request_headers', type: 'TEXT' },
                { name: 'webhook_request_body', type: 'TEXT' },
                { name: 'webhook_response_status', type: 'INTEGER' },
                { name: 'webhook_response_headers', type: 'TEXT' },
                { name: 'webhook_response_body', type: 'TEXT' },
                { name: 'webhook_error', type: 'TEXT' }
            ];

            for (const col of columnsToAdd) {
                if (!columnNames.includes(col.name)) {
                    console.log(`Adding column ${col.name} to request_logs table`);
                    await this.db.exec(`ALTER TABLE request_logs ADD COLUMN ${col.name} ${col.type}`);
                }
            }
        } catch (error) {
            console.error('Request logs migration error:', error);
        }
    }

    async migrateSlugColumns() {
        try {
            // Add slug to environments
            const envInfo = await this.db.all('PRAGMA table_info(environments)');
            if (!envInfo.find(c => c.name === 'slug')) {
                console.log('Adding slug column to environments table');
                await this.db.exec("ALTER TABLE environments ADD COLUMN slug TEXT DEFAULT ''");
                // Auto-populate slugs for existing records
                const envs = await this.db.all('SELECT id, name FROM environments');
                for (const env of envs) {
                    const slug = this.generateSlug(env.name);
                    await this.db.run('UPDATE environments SET slug = ? WHERE id = ?', [slug, env.id]);
                }
            }

            // Add slug to groups
            const groupInfo = await this.db.all('PRAGMA table_info(groups)');
            if (!groupInfo.find(c => c.name === 'slug')) {
                console.log('Adding slug column to groups table');
                await this.db.exec("ALTER TABLE groups ADD COLUMN slug TEXT DEFAULT ''");
                const groups = await this.db.all('SELECT id, name FROM groups');
                for (const group of groups) {
                    const slug = this.generateSlug(group.name);
                    await this.db.run('UPDATE groups SET slug = ? WHERE id = ?', [slug, group.id]);
                }
            }

            // Add slug to routes
            const routeInfo = await this.db.all('PRAGMA table_info(routes)');
            if (!routeInfo.find(c => c.name === 'slug')) {
                console.log('Adding slug column to routes table');
                await this.db.exec("ALTER TABLE routes ADD COLUMN slug TEXT DEFAULT ''");
                const routes = await this.db.all('SELECT id, path_pattern FROM routes');
                for (const route of routes) {
                    const slug = this.generateSlug(route.path_pattern);
                    await this.db.run('UPDATE routes SET slug = ? WHERE id = ?', [slug, route.id]);
                }
            }
        } catch (error) {
            console.error('Slug migration error:', error);
        }
    }

    async migrateUpdatedAtColumns() {
        try {
            for (const table of ['environments', 'groups', 'routes', 'rules']) {
                const info = await this.db.all(`PRAGMA table_info(${table})`);
                if (!info.find(c => c.name === 'updated_at')) {
                    console.log(`Adding updated_at column to ${table} table`);
                    await this.db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at TIMESTAMP`);
                    await this.db.exec(`UPDATE ${table} SET updated_at = created_at WHERE updated_at IS NULL`);
                }
            }
        } catch (error) {
            console.error('updated_at migration error:', error);
        }
    }

    async migrateSyncTrackingHash() {
        try {
            const info = await this.db.all('PRAGMA table_info(sync_tracking)');
            if (!info.find(c => c.name === 'content_hash')) {
                console.log('Adding content_hash column to sync_tracking table');
                await this.db.exec('ALTER TABLE sync_tracking ADD COLUMN content_hash TEXT');
            }
        } catch (error) {
            console.error('sync_tracking hash migration error:', error);
        }
    }

    async migrateEnvironmentServerId() {
        try {
            const info = await this.db.all('PRAGMA table_info(environments)');
            if (!info.find(c => c.name === 'server_id')) {
                console.log('Adding server_id column to environments table');
                await this.db.exec('ALTER TABLE environments ADD COLUMN server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL');
            }
        } catch (error) {
            console.error('Environment server_id migration error:', error);
        }
    }

    async migrateBasePathUnique() {
        try {
            // Remove the UNIQUE constraint on base_path since different servers can have same base_path
            // SQLite requires recreating the table to drop constraints
            const info = await this.db.all('PRAGMA table_info(environments)');
            const hasServerId = info.find(c => c.name === 'server_id');
            if (!hasServerId) return; // server_id migration not done yet

            // Check if UNIQUE constraint still exists by looking at index info
            const indexes = await this.db.all("PRAGMA index_list(environments)");
            const uniqueIdx = indexes.find(i => i.unique === 1 && i.name.includes('autoindex'));
            if (!uniqueIdx) return; // already migrated

            console.log('Removing UNIQUE constraint from environments.base_path (allowing same base_path across servers)');
            await this.db.exec('BEGIN TRANSACTION');
            await this.db.exec(`
                CREATE TABLE environments_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    base_path TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    is_active INTEGER DEFAULT 1,
                    slug TEXT DEFAULT '',
                    server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
                    updated_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO environments_new SELECT id, name, base_path, description, is_active, slug, server_id, updated_at, created_at FROM environments;
                DROP TABLE environments;
                ALTER TABLE environments_new RENAME TO environments;
            `);
            await this.db.exec('COMMIT');
            console.log('Environments table migrated successfully');
        } catch (error) {
            try { await this.db.exec('ROLLBACK'); } catch(e) {}
            console.error('base_path UNIQUE migration error:', error);
        }
    }

    generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/^\/+/, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            || 'untitled';
    }

    getConnection() {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }
}

module.exports = new Database();