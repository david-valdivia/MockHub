const crypto = require('crypto');

class TemplateEngine {
    resolve(template, context) {
        if (!template || typeof template !== 'string') return template;

        return template.replace(/\{\{([^}]+)\}\}/g, (fullMatch, expression) => {
            const trimmed = expression.trim();

            // Built-in variables
            if (trimmed === '$timestamp') return new Date().toISOString();
            if (trimmed === '$uuid') return crypto.randomUUID();
            if (trimmed === 'method') return context.method || '';

            // Dot-notation access: params.id, body.customer.email, etc.
            const value = this.getNestedValue(context, trimmed);
            if (value === undefined) return fullMatch; // Leave unresolved
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
        });
    }

    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            current = current[part];
        }
        return current;
    }
}

module.exports = new TemplateEngine();
