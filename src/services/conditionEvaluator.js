class ConditionEvaluator {
    evaluate(conditions, context) {
        if (!conditions || conditions.length === 0) return true;
        return conditions.every(condition => this.evaluateOne(condition, context));
    }

    evaluateOne(condition, context) {
        const { field, operator, value } = condition;
        const actual = this.getNestedValue(context, field);

        switch (operator) {
            case 'equals':
                return String(actual) === String(value);
            case 'not_equals':
                return String(actual) !== String(value);
            case 'contains':
                return actual != null && String(actual).includes(String(value));
            case 'not_contains':
                return actual == null || !String(actual).includes(String(value));
            case 'exists':
                return actual !== undefined && actual !== null;
            case 'not_exists':
                return actual === undefined || actual === null;
            case 'gt':
                return Number(actual) > Number(value);
            case 'gte':
                return Number(actual) >= Number(value);
            case 'lt':
                return Number(actual) < Number(value);
            case 'lte':
                return Number(actual) <= Number(value);
            case 'matches':
                try {
                    return actual != null && new RegExp(value).test(String(actual));
                } catch (e) {
                    return false;
                }
            case 'exists_in_logs':
                return this.checkExistsInLogs(context, field, actual);
            case 'not_exists_in_logs':
                return !this.checkExistsInLogs(context, field, actual);
            default:
                return false;
        }
    }

    checkExistsInLogs(context, field, currentValue) {
        if (!context._logs || !Array.isArray(context._logs)) return false;
        if (currentValue === undefined || currentValue === null) return false;

        // _logs are sorted DESC (newest first)
        const allMatches = context._logs.filter(log => {
            const logValue = this.getNestedValue(log, field);
            return logValue !== undefined && logValue !== null && String(logValue) === String(currentValue);
        });

        if (allMatches.length > 0) {
            // Store first (oldest) and last (newest) matching logs
            // _logs is DESC so: [0] = newest, [last] = oldest
            context._matchedLog = allMatches[allMatches.length - 1]; // oldest (first occurrence)
            context._matchedLogLast = allMatches[0]; // newest (last occurrence)
            return true;
        }
        return false;
    }

    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            if (current[part] !== undefined) {
                current = current[part];
            } else {
                // Case-insensitive fallback (handles headers like X-Api-Key vs x-api-key)
                const lower = part.toLowerCase();
                const key = Object.keys(current).find(k => k.toLowerCase() === lower);
                current = key !== undefined ? current[key] : undefined;
            }
        }
        return current;
    }
}

module.exports = new ConditionEvaluator();
