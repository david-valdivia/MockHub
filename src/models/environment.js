class Environment {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.basePath = data.base_path;
        this.description = data.description || '';
        this.slug = data.slug || '';
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
            isActive: this.isActive,
            createdAt: this.createdAt
        };
    }

    static validate(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
            errors.push('Name is required');
        }
        if (!data.base_path || typeof data.base_path !== 'string' || data.base_path.trim() === '') {
            errors.push('Base path is required');
        }
        return errors;
    }

    static sanitizeBasePath(basePath) {
        let cleaned = basePath.trim().replace(/\/+$/, '');
        if (!cleaned.startsWith('/')) {
            cleaned = '/' + cleaned;
        }
        return cleaned;
    }
}

module.exports = Environment;
