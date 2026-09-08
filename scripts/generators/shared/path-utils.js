import * as path from 'path'

export function getRelativePathFromSrcDir(fullPath, srcDirPath) {
    try {
        const normalized = path.normalize(fullPath)
        const normalizedSrcDir = path.normalize(srcDirPath)

        if (
            normalized === normalizedSrcDir ||
            normalized.startsWith(normalizedSrcDir + path.sep)
        ) {
            return path.relative(normalizedSrcDir, normalized)
        }

        return normalized
    } catch (error) {
        throw new Error(
            `Failed to get relative path: ${error instanceof Error ? error.message : error}`
        )
    }
}
