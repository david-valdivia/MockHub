class Route {
    constructor(data) {
        this.id = data.id;
        this.groupId = data.group_id;
        this.name = data.name || '';
        this.method = data.method || 'ALL';
        this.pathPattern = data.path_pattern || '';
        this.slug = data.slug || '';
        this.captureRequests = data.capture_requests !== undefined ? Boolean(data.capture_requests) : true;
        this.createdAt = data.created_at;
    }

    static fromDatabase(row) {
        return new Route(row);
    }

    toJSON() {
        return {
            id: this.id,
            groupId: this.groupId,
            name: this.name,
            method: this.method,
            pathPattern: this.pathPattern,
            slug: this.slug,
            captureRequests: this.captureRequests,
            createdAt: this.createdAt
        };
    }

    static validate(data) {
        const errors = [];
        const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ALL'];
        if (data.method && !validMethods.includes(data.method.toUpperCase())) {
            errors.push('Invalid HTTP method');
        }
        // path_pattern is optional (empty string is valid)
        if (!data.group_id || typeof data.group_id !== 'number') {
            errors.push('Group ID is required');
        }
        return errors;
    }
}

module.exports = Route;
