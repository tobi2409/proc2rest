import * as path from 'path'

export function getCliArgValue(flagName) {
    const index = process.argv.lastIndexOf(flagName)

    if (index >= 0 && process.argv[index + 1]) {
        return process.argv[index + 1]
    }

    const withEquals = [...process.argv].reverse().find((arg) => arg.startsWith(`${flagName}=`))

    if (withEquals) {
        return withEquals.slice(flagName.length + 1)
    }

    return undefined
}

export function getAppRootPath() {
    const cliPath = getCliArgValue('--appPath')
    const rawPath = cliPath ?? '../'

    return path.resolve(rawPath)
}

function resolveGeneratedPath(appRootPath, cliValue, fallbackRelativePath) {
    const basePath = cliValue ?? fallbackRelativePath

    return path.isAbsolute(basePath)
        ? path.resolve(basePath)
        : path.resolve(appRootPath, basePath)
}

export function getGeneratedServerRootPath(appRootPath = getAppRootPath()) {
    return resolveGeneratedPath(appRootPath, getCliArgValue('--generatedServerDir'), 'generated/server')
}

export function getGeneratedClientRootPath(appRootPath = getAppRootPath()) {
    return resolveGeneratedPath(appRootPath, getCliArgValue('--generatedClientDir'), 'generated/client')
}

export function getConfigPath(appRootPath = getAppRootPath()) {
    const cliConfigPath = getCliArgValue('--configPath')

    if (!cliConfigPath) {
        return path.join(appRootPath, 'proc2rest.config.json')
    }

    return path.isAbsolute(cliConfigPath)
        ? path.resolve(cliConfigPath)
        : path.resolve(appRootPath, cliConfigPath)
}
