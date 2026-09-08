import * as path from 'path'

export function assertValidIdentifier(value, fieldName) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
        throw new Error(`Invalid ${fieldName}: ${JSON.stringify(value)}`)
    }
}

export function assertPathInsideDirectory(filePath, directoryPath, fieldName) {
    const relativePath = path.relative(directoryPath, filePath)
    if (relativePath.startsWith('..' + path.sep) || path.isAbsolute(relativePath)) {
        throw new Error(`${fieldName} must be inside ${directoryPath}`)
    }
}