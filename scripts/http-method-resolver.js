export function resolveHttpMethod(methodName) {
    const lower = methodName.toLowerCase()

    if (lower.startsWith('get') || lower.startsWith('list') || lower.startsWith('find')) {
        return 'GET'
    }

    if (lower.startsWith('create') || lower.startsWith('add') || lower.startsWith('insert')) {
        return 'POST'
    }

    if (lower.startsWith('update') || lower.startsWith('set') || lower.startsWith('patch')) {
        return 'PATCH'
    }

    if (lower.startsWith('delete') || lower.startsWith('remove')) {
        return 'DELETE'
    }

    return 'POST'
}