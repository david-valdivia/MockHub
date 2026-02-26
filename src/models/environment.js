class Environment {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.basePath = data.base_path;
        this.description = data.description || '';
        this.slug = data.slug || '';
        this.serverId = data.server_id || null;
        this.isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;
        this.createdAt = data.created_at;
    }

    static fromDatabase(row) {
        return new Environment(row);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            basePath: this.basePath,
            description: this.description,
            slug: this.slug,
            serverId: this.serverId,
            isActive: this.isActive,
            createdAt: this.createdAt
        };
    }

    static validate(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
            errors.push('Name is required');
        }
        // base_path is optional (empty string is valid)
        return errors;
    }

    static sanitizeBasePath(basePath) {
        if (!basePath || basePath.trim() === '') return '';
        let cleaned = basePath.trim().replace(/\/+$/, '');
        if (!cleaned.startsWith('/')) {
            cleaned = '/' + cleaned;
        }
        return cleaned;
    }
}

module.exports = Environment;
