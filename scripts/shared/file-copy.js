import * as fs from 'fs'
import * as path from 'path'

export function copyDirectoryRecursive(sourceDir, destDir) {
    try {
        const normalizedDestDir = path.resolve(destDir)

        // Remove destination if it exists
        if (fs.existsSync(destDir)) {
            fs.rmSync(destDir, { recursive: true, force: true })
        }

        // Create destination directory
        fs.mkdirSync(destDir, { recursive: true })

        // Copy all files and subdirectories
        const entries = fs.readdirSync(sourceDir, { withFileTypes: true })

        for (const entry of entries) {
            const sourcePath = path.join(sourceDir, entry.name)
            const destPath = path.join(destDir, entry.name)

            // Skip entries that contain or equal the destination (avoids infinite recursion
            // when destDir is inside sourceDir)
            const normalizedSourcePath = path.resolve(sourcePath)
            if (
                normalizedDestDir === normalizedSourcePath ||
                normalizedDestDir.startsWith(normalizedSourcePath + path.sep)
            ) {
                continue
            }

            if (entry.isDirectory()) {
                copyDirectoryRecursive(sourcePath, destPath)
            } else {
                fs.copyFileSync(sourcePath, destPath)
            }
        }
    } catch (error) {
        throw new Error(`Failed to copy directory from '${sourceDir}' to '${destDir}': ${error instanceof Error ? error.message : error}`)
    }
}

export function copySourceTree(srcPath, destPath) {
    try {
        if (!fs.existsSync(srcPath)) {
            throw new Error(`Source directory not found: ${srcPath}`)
        }

        copyDirectoryRecursive(srcPath, destPath)
    } catch (error) {
        throw new Error(`Failed to copy source tree: ${error instanceof Error ? error.message : error}`)
    }
}
