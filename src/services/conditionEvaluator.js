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

        return context._logs.some(log => {
            const logValue = this.getNestedValue(log, field);
            return logValue !== undefined && logValue !== null && String(logValue) === String(currentValue);
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

module.exports = new ConditionEvaluator();
