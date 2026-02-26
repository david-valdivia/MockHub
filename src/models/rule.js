class Rule {
    constructor(data) {
        this.id = data.id;
        this.routeId = data.route_id;
        this.name = data.name || '';
        this.priority = data.priority || 0;
        this.conditions = typeof data.conditions === 'string' ? JSON.parse(data.conditions) : (data.conditions || []);
        this.statusCode = data.status_code || 200;
        this.contentType = data.content_type || 'application/json';
        this.body = data.body || '{"message":"OK"}';
        this.delay = data.delay || 0;
        this.webhookUrl = data.webhook_url || null;
        this.webhookMethod = data.webhook_method || 'POST';
        this.webhookHeaders = typeof data.webhook_headers === 'string' ? JSON.parse(data.webhook_headers || '{}') : (data.webhook_headers || {});
        this.webhookBody = data.webhook_body || null;
        this.webhookDelay = data.webhook_delay || 0;
        this.webhookContentType = data.webhook_content_type || 'application/json';
        this.webhookEnabled = data.webhook_enabled !== undefined ? !!data.webhook_enabled : true;
        this.createdAt = data.created_at;
    }

    static fromDatabase(row) {
        return new Rule(row);
    }

    toJSON() {
        return {
            id: this.id,
            routeId: this.routeId,
            name: this.name,
            priority: this.priority,
            conditions: this.conditions,
            statusCode: this.statusCode,
            contentType: this.contentType,
            body: this.body,
            delay: this.delay,
            webhookUrl: this.webhookUrl,
            webhookMethod: this.webhookMethod,
            webhookHeaders: this.webhookHeaders,
            webhookBody: this.webhookBody,
            webhookDelay: this.webhookDelay,
            webhookContentType: this.webhookContentType,
            webhookEnabled: this.webhookEnabled,
            createdAt: this.createdAt
        };
    }

    toDatabaseFormat() {
        return {
            route_id: this.routeId,
            name: this.name,
            priority: this.priority,
            conditions: JSON.stringify(this.conditions),
            status_code: this.statusCode,
            content_type: this.contentType,
            body: this.body,
            delay: this.delay,
            webhook_url: this.webhookUrl,
            webhook_method: this.webhookMethod,
            webhook_headers: JSON.stringify(this.webhookHeaders),
            webhook_body: this.webhookBody,
            webhook_delay: this.webhookDelay,
            webhook_content_type: this.webhookContentType,
            webhook_enabled: this.webhookEnabled ? 1 : 0
        };
    }

    static validate(data) {
        const errors = [];
        if (!data.route_id || typeof data.route_id !== 'number') {
            errors.push('Route ID is required');
        }
        if (data.status_code && (data.status_code < 100 || data.status_code > 599)) {
            errors.push('Status code must be between 100 and 599');
        }
        if (data.delay && (data.delay < 0 || data.delay > 30000)) {
            errors.push('Delay must be between 0 and 30000 milliseconds');
        }
        return errors;
    }

    static createDefault(routeId) {
        return new Rule({
            route_id: routeId,
            name: 'Default',
            priority: 0,
            conditions: [],
            status_code: 200,
            content_type: 'application/json',
            body: JSON.stringify({ message: 'OK' }),
            delay: 0
        });
    }
}

module.exports = Rule;
