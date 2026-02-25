const crypto = require('crypto');

class TemplateEngine {
    resolve(template, context) {
        if (!template || typeof template !== 'string') return template;

        return template.replace(/\{\{([^}]+)\}\}/g, (fullMatch, expression) => {
            // Support fallback chain: {{primary|fallback1|fallback2|"literal"}}
            const parts = expression.split('|').map(s => s.trim());

            for (const part of parts) {
                const result = this.resolveOne(part, context);
                if (result !== undefined) return result;
            }

            return fullMatch; // Nothing resolved, leave as-is
        });
    }

    resolveOne(expr, context) {
        // Quoted literal fallback: "some text" or 'some text'
        const literalMatch = expr.match(/^["'](.*)["']$/);
        if (literalMatch) return literalMatch[1];

        // Built-in variables
        if (expr === '$timestamp') return new Date().toISOString();
        if (expr === '$uuid') return crypto.randomUUID();
        if (expr === '$randomInt') return Math.floor(Math.random() * 1000000).toString();
        if (expr === '$randomFloat') return (Math.random() * 1000).toFixed(2);
        if (expr === '$randomBool') return Math.random() > 0.5 ? 'true' : 'false';
        if (expr === '$randomEmail') return `user${Math.floor(Math.random() * 99999)}@example.com`;
        if (expr === '$randomName') {
            const names = ['Alice','Bob','Carlos','Diana','Eva','Frank','Grace','Hugo','Iris','Jack'];
            return names[Math.floor(Math.random() * names.length)];
        }
        if (expr === '$now') return Date.now().toString();
        if (expr === '$date') return new Date().toISOString().split('T')[0];
        if (expr === '$time') return new Date().toISOString().split('T')[1].split('.')[0];
        if (expr === '$isoDate') return new Date().toISOString();

        // $randomString:N
        const randomStrMatch = expr.match(/^\$randomString(?::(\d+))?$/);
        if (randomStrMatch) {
            const len = parseInt(randomStrMatch[1] || '8');
            return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
        }

        // $enum:val1,val2,val3
        const enumMatch = expr.match(/^\$enum:(.+)$/);
        if (enumMatch) {
            const options = enumMatch[1].split(',').map(s => s.trim());
            return options[Math.floor(Math.random() * options.length)];
        }

        // $seq (simple incrementing counter per request)
        if (expr === '$seq') {
            this._seq = (this._seq || 0) + 1;
            return this._seq.toString();
        }

        // $repeat:N:template — repeat a pattern N times
        const repeatMatch = expr.match(/^\$repeat:(\d+):(.+)$/);
        if (repeatMatch) {
            const count = parseInt(repeatMatch[1]);
            const tpl = repeatMatch[2];
            const items = [];
            for (let i = 0; i < count; i++) {
                items.push(tpl.replace(/\$i/g, i.toString()));
            }
            return items.join(',');
        }

        // Context access
        if (expr === 'method') return context.method || '';

        // Dot-notation access: params.id, body.customer.email, logs.body.name, etc.
        const value = this.getNestedValue(context, expr);
        if (value === undefined || value === null) return undefined; // Try next fallback
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
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
