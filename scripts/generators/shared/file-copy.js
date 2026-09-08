import * as fs from 'fs'
import * as path from 'path'

// preserveEntries keeps named entries already present in the destination,
// while excludedSourcePaths skips matching files or directories from the source.
export function copyDirectoryRecursive(
    sourceDir,
    destDir,
    { preserveEntries = [], excludedSourcePaths = [] } = {}
) {
    try {
        const normalizedDestDir = path.resolve(destDir)

        // Create destination directory if it doesn't exist
        fs.mkdirSync(destDir, { recursive: true })

        // Remove existing destination entries except preserved ones (e.g. node_modules)
        for (const entry of fs.readdirSync(destDir, { withFileTypes: true })) {
            if (preserveEntries.includes(entry.name)) continue
            fs.rmSync(path.join(destDir, entry.name), {
                recursive: true,
                force: true
            })
        }

        // Copy all files and subdirectories from source
        for (const entry of fs.readdirSync(sourceDir, {
            withFileTypes: true
        })) {
            const sourcePath = path.join(sourceDir, entry.name)
            const destPath = path.join(destDir, entry.name)
            const normalizedSourcePath = path.resolve(sourcePath)

            if (
                excludedSourcePaths.some(
                    (excludedPath) =>
                        excludedPath === normalizedSourcePath ||
                        normalizedSourcePath.startsWith(excludedPath + path.sep)
                )
            ) {
                continue
            }

            // Skip entries that contain or equal the destination (avoids infinite recursion
            // when destDir is inside sourceDir)
            if (
                normalizedDestDir === normalizedSourcePath ||
                normalizedDestDir.startsWith(normalizedSourcePath + path.sep)
            ) {
                continue
            }

            if (entry.isDirectory()) {
                copyDirectoryRecursive(sourcePath, destPath, {
                    preserveEntries,
                    excludedSourcePaths
                })
            } else {
                fs.copyFileSync(sourcePath, destPath)
            }
        }
    } catch (error) {
        throw new Error(
            `Failed to copy directory from '${sourceDir}' to '${destDir}': ${error instanceof Error ? error.message : error}`
        )
    }
}

export function copySourceTree(srcPath, destPath, { excludePaths = [] } = {}) {
    try {
        if (!fs.existsSync(srcPath)) {
            throw new Error(`Source directory not found: ${srcPath}`)
        }

        copyDirectoryRecursive(srcPath, destPath, {
            preserveEntries: ['node_modules'],
            excludedSourcePaths: excludePaths.map((excludedPath) =>
                path.resolve(excludedPath)
            )
        })
    } catch (error) {
        throw new Error(
            `Failed to copy source tree: ${error instanceof Error ? error.message : error}`
        )
    }
}
