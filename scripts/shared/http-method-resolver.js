const defaultMethodRules = {
    GET: '^(get|list|find)',
    POST: '^(create|add|insert)',
    PATCH: '^(update|set|patch)',
    DELETE: '^(delete|remove)'
}

export function resolveHttpMethod(functionName, methodRules = defaultMethodRules, customFunctions = {}) {
    const overrideMethod = customFunctions[functionName]
    if (overrideMethod) {
        return overrideMethod
    }

    for (const [httpMethod, functionNamePattern] of Object.entries(methodRules)) {
        if (typeof functionNamePattern !== 'string') {
            continue
        }

        if (new RegExp(functionNamePattern, 'i').test(functionName)) {
            return httpMethod
        }
    }

    return 'POST'
}
