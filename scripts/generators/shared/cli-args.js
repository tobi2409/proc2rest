import * as path from 'path'

function getCliArgValue(flagName) {
    try {
        const index = process.argv.lastIndexOf(flagName)

        if (index >= 0 && process.argv[index + 1]) {
            return process.argv[index + 1]
        }

        const withEquals = [...process.argv]
            // reverse analog wie lastIndexOf: die letzte passende --flag=value-Angabe gewinnt.
            .reverse()
            .find((arg) => arg.startsWith(`${flagName}=`))

        if (withEquals) {
            return withEquals.slice(flagName.length + 1)
        }

        return undefined
    } catch (error) {
        throw new Error(
            `Failed to get CLI arg value for '${flagName}': ${error instanceof Error ? error.message : error}`
        )
    }
}

export function getAppRootPath() {
    try {
        const cliPath = getCliArgValue('--appPath')
        const rawPath = cliPath ?? './'

        return path.resolve(rawPath)
    } catch (error) {
        throw new Error(
            `Failed to get app root path: ${error instanceof Error ? error.message : error}`
        )
    }
}

function resolveGeneratedPath(appRootPath, cliValue, fallbackRelativePath) {
    try {
        const basePath = cliValue ?? fallbackRelativePath

        return path.isAbsolute(basePath)
            ? path.resolve(basePath)
            : path.resolve(appRootPath, basePath)
    } catch (error) {
        throw new Error(
            `Failed to resolve path: ${error instanceof Error ? error.message : error}`
        )
    }
}

export function getGeneratedServerRootPath(appRootPath = getAppRootPath()) {
    return resolveGeneratedPath(
        appRootPath,
        getCliArgValue('--generatedServerDir'),
        'generated/server'
    )
}

export function getGeneratedClientRootPath(appRootPath = getAppRootPath()) {
    return resolveGeneratedPath(
        appRootPath,
        getCliArgValue('--generatedClientDir'),
        'generated/client'
    )
}

export function getConfigPath(appRootPath = getAppRootPath()) {
    try {
        const cliConfigPath = getCliArgValue('--configPath')

        if (!cliConfigPath) {
            return path.join(appRootPath, 'proc2rest.config.json')
        }

        return path.isAbsolute(cliConfigPath)
            ? path.resolve(cliConfigPath)
            : path.resolve(appRootPath, cliConfigPath)
    } catch (error) {
        throw new Error(
            `Failed to get config path: ${error instanceof Error ? error.message : error}`
        )
    }
}

export function getSrcServerRootPath(appRootPath = getAppRootPath()) {
    return resolveGeneratedPath(
        appRootPath,
        getCliArgValue('--srcServerDir'),
        'src/server'
    )
}

export function getSrcClientRootPath(appRootPath = getAppRootPath()) {
    return resolveGeneratedPath(
        appRootPath,
        getCliArgValue('--srcClientDir'),
        'src/client'
    )
}
