import * as fs from 'fs'
import { getAppRootPath, getConfigPath } from './cli-args.js'

const defaultConfig = {
    apiUrl: 'http://localhost:3000',
    cors: {
        origin: '*'
    }
}

function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getGeneratorConfig(appRootPath = getAppRootPath()) {
    const configPath = getConfigPath(appRootPath)

    if (!fs.existsSync(configPath)) {
        return defaultConfig
    }

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))

    return {
        ...defaultConfig,
        ...(isObject(parsed) ? parsed : {})
    }
}
