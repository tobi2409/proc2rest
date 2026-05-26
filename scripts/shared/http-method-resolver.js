const defaultMethodRules = {
    GET: '^(get|list|find)',
    POST: '^(create|add|insert)',
    PATCH: '^(update|set|patch)',
    DELETE: '^(delete|remove)'
}

export function resolveHttpMethod(methodName, methodRules = defaultMethodRules, customFunctions = {}) {
    const overrideMethod = customFunctions[methodName]
    if (overrideMethod) {
        return overrideMethod
    }

    for (const [httpMethod, functionNamePattern] of Object.entries(methodRules)) {
        if (typeof functionNamePattern !== 'string') {
            continue
        }

        if (new RegExp(functionNamePattern, 'i').test(methodName)) {
            return httpMethod
        }
    }

    return 'POST'
}
