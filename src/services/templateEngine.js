const crypto = require('crypto');

class TemplateEngine {
    resolve(template, context) {
        if (!template || typeof template !== 'string') return template;

        return template.replace(/\{\{([^}]+)\}\}/g, (fullMatch, expression) => {
            const trimmed = expression.trim();

            // Built-in variables
            if (trimmed === '$timestamp') return new Date().toISOString();
            if (trimmed === '$uuid') return crypto.randomUUID();
            if (trimmed === '$randomInt') return Math.floor(Math.random() * 1000000).toString();
            if (trimmed === '$randomFloat') return (Math.random() * 1000).toFixed(2);
            if (trimmed === '$randomBool') return Math.random() > 0.5 ? 'true' : 'false';
            if (trimmed === '$randomEmail') return `user${Math.floor(Math.random() * 99999)}@example.com`;
            if (trimmed === '$randomName') {
                const names = ['Alice','Bob','Carlos','Diana','Eva','Frank','Grace','Hugo','Iris','Jack'];
                return names[Math.floor(Math.random() * names.length)];
            }
            if (trimmed === '$now') return Date.now().toString();
            if (trimmed === '$date') return new Date().toISOString().split('T')[0];
            if (trimmed === '$time') return new Date().toISOString().split('T')[1].split('.')[0];
            if (trimmed === '$isoDate') return new Date().toISOString();

            // $randomString:N
            const randomStrMatch = trimmed.match(/^\$randomString(?::(\d+))?$/);
            if (randomStrMatch) {
                const len = parseInt(randomStrMatch[1] || '8');
                return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
            }

            // $enum:val1,val2,val3
            const enumMatch = trimmed.match(/^\$enum:(.+)$/);
            if (enumMatch) {
                const options = enumMatch[1].split(',').map(s => s.trim());
                return options[Math.floor(Math.random() * options.length)];
            }

            // $seq (simple incrementing counter per request)
            if (trimmed === '$seq') {
                this._seq = (this._seq || 0) + 1;
                return this._seq.toString();
            }

            // $repeat:N:template — repeat a pattern N times
            const repeatMatch = trimmed.match(/^\$repeat:(\d+):(.+)$/);
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
