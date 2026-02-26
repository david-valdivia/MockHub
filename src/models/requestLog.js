class RequestLog {
    constructor(data) {
        this.id = data.id;
        this.routeId = data.route_id;
        this.environmentId = data.environment_id;
        this.method = data.method;
        this.path = data.path;
        this.headers = typeof data.headers === 'string' ? JSON.parse(data.headers) : data.headers;
        this.queryParams = data.query_params ?
            (typeof data.query_params === 'string' ? JSON.parse(data.query_params) : data.query_params)
            : null;
        this.body = data.body ?
            (typeof data.body === 'string' ? this.tryParseJSON(data.body) : data.body)
            : null;
        this.matchedRuleId = data.matched_rule_id;
        this.responseStatus = data.response_status;
        this.responseBody = data.response_body;
        this.webhookSent = !!data.webhook_sent;
        this.webhookUrl = data.webhook_url || null;
        this.webhookMethod = data.webhook_method || null;
        this.webhookRequestHeaders = data.webhook_request_headers ?
            (typeof data.webhook_request_headers === 'string' ? this.tryParseJSON(data.webhook_request_headers) : data.webhook_request_headers)
            : null;
        this.webhookRequestBody = data.webhook_request_body || null;
        this.webhookResponseStatus = data.webhook_response_status || null;
        this.webhookResponseHeaders = data.webhook_response_headers ?
            (typeof data.webhook_response_headers === 'string' ? this.tryParseJSON(data.webhook_response_headers) : data.webhook_response_headers)
            : null;
        this.webhookResponseBody = data.webhook_response_body || null;
        this.webhookError = data.webhook_error || null;
        this.timestamp = data.timestamp;
    }

    static fromDatabase(row) {
        return new RequestLog(row);
    }

    toJSON() {
        return {
            id: this.id,
            routeId: this.routeId,
            environmentId: this.environmentId,
            method: this.method,
            path: this.path,
            headers: this.headers,
            queryParams: this.queryParams,
            body: this.body,
            matchedRuleId: this.matchedRuleId,
            responseStatus: this.responseStatus,
            responseBody: this.responseBody,
            webhookSent: this.webhookSent,
            webhookUrl: this.webhookUrl,
            webhookMethod: this.webhookMethod,
            webhookRequestHeaders: this.webhookRequestHeaders,
            webhookRequestBody: this.webhookRequestBody,
            webhookResponseStatus: this.webhookResponseStatus,
            webhookResponseHeaders: this.webhookResponseHeaders,
            webhookResponseBody: this.webhookResponseBody,
            webhookError: this.webhookError,
            timestamp: this.timestamp
        };
    }

    toDatabaseFormat() {
        return {
            route_id: this.routeId,
            environment_id: this.environmentId,
            method: this.method,
            path: this.path,
            headers: JSON.stringify(this.headers),
            query_params: this.queryParams ? JSON.stringify(this.queryParams) : null,
            body: this.body ? JSON.stringify(this.body) : null,
            matched_rule_id: this.matchedRuleId,
            response_status: this.responseStatus,
            response_body: this.responseBody
        };
    }

    tryParseJSON(str) {
        try { return JSON.parse(str); } catch (e) { return str; }
    }
}

module.exports = RequestLog;
