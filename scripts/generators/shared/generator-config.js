import * as fs from 'fs'
import { getAppRootPath, getConfigPath } from './cli-args.js'

const defaultConfig = {
    apiUrl: 'http://localhost:3000',
    cors: {
        allowOrigin: '*'
    },
    errorStatusCodes: {}
}

const generatorConfigCache = new Map()

function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getGeneratorConfig(appRootPath = getAppRootPath()) {
    try {
        const configPath = getConfigPath(appRootPath)

        if (!fs.existsSync(configPath)) {
            return defaultConfig
        }

        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))

        return {
            ...defaultConfig,
            ...(isObject(parsed) ? parsed : {})
        }
    } catch (error) {
        throw new Error(
            `Failed to load generator config: ${error instanceof Error ? error.message : error}`
        )
    }
}

export function getCachedGeneratorConfig(appRootPath = getAppRootPath()) {
    try {
        if (!generatorConfigCache.has(appRootPath)) {
            generatorConfigCache.set(
                appRootPath,
                getGeneratorConfig(appRootPath)
            )
        }

        return generatorConfigCache.get(appRootPath)
    } catch (error) {
        throw new Error(
            `Failed to get cached generator config: ${error instanceof Error ? error.message : error}`
        )
    }
}
