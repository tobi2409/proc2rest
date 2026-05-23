import * as fs from 'fs'
import * as path from 'path'
import { getAppRootPath } from './app-path.js'

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
    const configPath = path.join(appRootPath, 'proc2rest.config.json')

    if (!fs.existsSync(configPath)) {
        return defaultConfig
    }

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))

    return {
        ...defaultConfig,
        ...(isObject(parsed) ? parsed : {})
    }
}
