import * as path from 'path'

function getCliArgValue(flagName) {
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
