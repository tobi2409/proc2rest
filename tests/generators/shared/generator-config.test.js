import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getGeneratorConfig, getCachedGeneratorConfig } from '../../../scripts/generators/shared/generator-config.js'

function makeTempAppRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'proc2rest-config-'))
}

test('returns the default config when no config file exists', () => {
    const appRoot = makeTempAppRoot()
    try {
        const config = getGeneratorConfig(appRoot)

        assert.equal(config.apiUrl, 'http://localhost:3000')
        assert.deepEqual(config.cors, { allowOrigin: '*' })
        assert.deepEqual(config.errorStatusCodes, {})
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})

test('merges the config file contents over the defaults', () => {
    const appRoot = makeTempAppRoot()
    try {
        fs.writeFileSync(
            path.join(appRoot, 'proc2rest.config.json'),
            JSON.stringify({ apiUrl: 'https://example.test', servers: [] })
        )

        const config = getGeneratorConfig(appRoot)

        assert.equal(config.apiUrl, 'https://example.test')
        assert.deepEqual(config.servers, [])
        assert.deepEqual(config.cors, { allowOrigin: '*' })
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})

test('throws a descriptive error for invalid JSON in the config file', () => {
    const appRoot = makeTempAppRoot()
    try {
        fs.writeFileSync(path.join(appRoot, 'proc2rest.config.json'), '{ not json')

        assert.throws(
            () => getGeneratorConfig(appRoot),
            /Failed to load generator config/
        )
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})

test('caches the config per app root path', () => {
    const appRoot = makeTempAppRoot()
    try {
        const first = getCachedGeneratorConfig(appRoot)
        fs.writeFileSync(
            path.join(appRoot, 'proc2rest.config.json'),
            JSON.stringify({ apiUrl: 'https://changed.test' })
        )
        const second = getCachedGeneratorConfig(appRoot)

        assert.strictEqual(first, second)
        assert.equal(second.apiUrl, 'http://localhost:3000')
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})
