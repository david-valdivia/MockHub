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
            default:
                return false;
        }
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
