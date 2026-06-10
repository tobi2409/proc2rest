import * as path from 'path'

export function getCliArgValue(flagName) {
    const index = process.argv.indexOf(flagName)

    if (index >= 0 && process.argv[index + 1]) {
        return process.argv[index + 1]
    }

    const withEquals = process.argv.find((arg) => arg.startsWith(`${flagName}=`))

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

export function getGeneratedRootPath(appRootPath = getAppRootPath()) {
    const cliGeneratedDir = getCliArgValue('--generatedDir')

    if (!cliGeneratedDir) {
        return path.join(appRootPath, 'generated')
    }

    return path.isAbsolute(cliGeneratedDir)
        ? path.resolve(cliGeneratedDir)
        : path.resolve(appRootPath, cliGeneratedDir)
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
