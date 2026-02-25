class Group {
    constructor(data) {
        this.id = data.id;
        this.environmentId = data.environment_id;
        this.name = data.name;
        this.sortOrder = data.sort_order || 0;
        this.createdAt = data.created_at;
    }

    static fromDatabase(row) {
        return new Group(row);
    }

    toJSON() {
        return {
            id: this.id,
            environmentId: this.environmentId,
            name: this.name,
            sortOrder: this.sortOrder,
            createdAt: this.createdAt
        };
    }

    static validate(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
            errors.push('Name is required');
        }
        if (!data.environment_id || typeof data.environment_id !== 'number') {
            errors.push('Environment ID is required');
        }
        return errors;
    }
}

module.exports = Group;
