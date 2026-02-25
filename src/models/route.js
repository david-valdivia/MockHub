class Route {
    constructor(data) {
        this.id = data.id;
        this.groupId = data.group_id;
        this.method = data.method || 'ALL';
        this.pathPattern = data.path_pattern;
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
            method: this.method,
            pathPattern: this.pathPattern,
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
        if (!data.path_pattern || typeof data.path_pattern !== 'string') {
            errors.push('Path pattern is required');
        }
        if (!data.group_id || typeof data.group_id !== 'number') {
            errors.push('Group ID is required');
        }
        return errors;
    }
}

module.exports = Route;
