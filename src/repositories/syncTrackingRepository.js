const database = require('../config/database');

class SyncTrackingRepository {
    async recordPush(serverId, entityType, entityId, contentHash = null) {
        const db = database.getConnection();
        await db.run(
            `INSERT INTO sync_tracking (server_id, entity_type, entity_id, pushed_at, content_hash)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(server_id, entity_type, entity_id)
             DO UPDATE SET pushed_at = ?, content_hash = ?`,
            [serverId, entityType, entityId, new Date().toISOString(), contentHash,
             new Date().toISOString(), contentHash]
        );
    }

    async getSyncStatus(serverId, entityType, entityId) {
        const db = database.getConnection();
        return db.get(
            'SELECT * FROM sync_tracking WHERE server_id = ? AND entity_type = ? AND entity_id = ?',
            [serverId, entityType, entityId]
        );
    }

    async getSyncStatusBulk(serverId) {
        const db = database.getConnection();
        return db.all('SELECT * FROM sync_tracking WHERE server_id = ?', [serverId]);
    }

    async getEnvironmentSyncMap(serverId, localHashes = {}) {
        const db = database.getConnection();

        const envs = await db.all(`
            SELECT e.id, e.updated_at, st.pushed_at, st.content_hash
            FROM environments e
            LEFT JOIN sync_tracking st ON st.entity_id = e.id AND st.entity_type = 'environment' AND st.server_id = ?
        `, [serverId]);

        const groups = await db.all(`
            SELECT g.id, g.environment_id, g.updated_at, st.pushed_at, st.content_hash
            FROM groups g
            LEFT JOIN sync_tracking st ON st.entity_id = g.id AND st.entity_type = 'group' AND st.server_id = ?
        `, [serverId]);

        const routes = await db.all(`
            SELECT r.id, r.group_id, r.updated_at, st.pushed_at, st.content_hash,
                   g.environment_id
            FROM routes r
            JOIN groups g ON r.group_id = g.id
            LEFT JOIN sync_tracking st ON st.entity_id = r.id AND st.entity_type = 'route' AND st.server_id = ?
        `, [serverId]);

        const rules = await db.all(`
            SELECT ru.id, ru.route_id, ru.updated_at, st.pushed_at, st.content_hash,
                   r.group_id, g.environment_id
            FROM rules ru
            JOIN routes r ON ru.route_id = r.id
            JOIN groups g ON r.group_id = g.id
            LEFT JOIN sync_tracking st ON st.entity_id = ru.id AND st.entity_type = 'rule' AND st.server_id = ?
        `, [serverId]);

        // Determine status using hash comparison when available, fall back to timestamp
        function status(entity, entityType, entityId) {
            if (!entity.pushed_at) return 'not_pushed';
            // If we have a stored hash and a current local hash, compare them
            if (entity.content_hash && localHashes[entityType] && localHashes[entityType][entityId]) {
                return entity.content_hash === localHashes[entityType][entityId] ? 'synced' : 'modified';
            }
            // Fallback to timestamp comparison
            if (!entity.updated_at) return 'synced';
            return new Date(entity.updated_at) > new Date(entity.pushed_at) ? 'modified' : 'synced';
        }

        const envMap = {};
        for (const e of envs) {
            envMap[e.id] = { status: status(e, 'environment', e.id) };
        }

        const groupMap = {};
        for (const g of groups) {
            groupMap[g.id] = { status: status(g, 'group', g.id), environmentId: g.environment_id };
        }

        const routeMap = {};
        for (const r of routes) {
            routeMap[r.id] = { status: status(r, 'route', r.id), groupId: r.group_id, environmentId: r.environment_id };
        }

        // Bubble up: rules → routes → groups → environments
        for (const ru of rules) {
            const ruStatus = status(ru, 'rule', ru.id);
            if (ruStatus !== 'synced' && routeMap[ru.route_id]) {
                if (routeMap[ru.route_id].status === 'synced') {
                    routeMap[ru.route_id].status = ruStatus;
                }
            }
        }

        for (const [, r] of Object.entries(routeMap)) {
            if (r.status !== 'synced' && groupMap[r.groupId]) {
                if (groupMap[r.groupId].status === 'synced') {
                    groupMap[r.groupId].status = r.status;
                }
            }
        }

        for (const [, g] of Object.entries(groupMap)) {
            if (g.status !== 'synced' && envMap[g.environmentId]) {
                if (envMap[g.environmentId].status === 'synced') {
                    envMap[g.environmentId].status = g.status;
                }
            }
        }

        return { environments: envMap, groups: groupMap, routes: routeMap };
    }

    async deleteByServer(serverId) {
        const db = database.getConnection();
        await db.run('DELETE FROM sync_tracking WHERE server_id = ?', [serverId]);
    }
}

module.exports = new SyncTrackingRepository();
