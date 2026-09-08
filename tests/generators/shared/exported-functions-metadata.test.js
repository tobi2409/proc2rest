import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getExportedFunctionsMetadata } from '../../../scripts/generators/shared/exported-functions-metadata.js'

function makeFixture(serverFileContent, configOverrides = {}) {
    const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proc2rest-meta-'))

    fs.mkdirSync(path.join(appRoot, 'src/server'), { recursive: true })

    fs.writeFileSync(path.join(appRoot, 'src/server/sample.ts'), serverFileContent)
    fs.writeFileSync(
        path.join(appRoot, 'proc2rest.config.json'),
        JSON.stringify({
            servers: [{ src: 'src/server/sample.ts', namespace: 'sample' }],
            binaryTypes: ['Uint8Array', 'Uint8Array<ArrayBuffer>'],
            ...configOverrides
        })
    )

    return appRoot
}

test('extracts metadata for exported functions marked with @rest', () => {
    const appRoot = makeFixture(`
// @rest
// @middleware(mid1, mid2)
export async function getPerson(name: string): Promise<string> {
    return name
}

function notExported() {}
`)

    try {
        const metadata = getExportedFunctionsMetadata(appRoot)

        assert.equal(metadata.length, 1)
        const [entry] = metadata
        assert.equal(entry.functionName, 'getPerson')
        assert.equal(entry.hasRestMarker, true)
        assert.equal(entry.httpMethod, 'GET')
        assert.deepEqual(entry.middlewares, ['mid1', 'mid2'])
        assert.equal(entry.path, '/api/sample/getPerson')
        assert.deepEqual(entry.params, [
            {
                name: 'name',
                type: 'string',
                isBinary: false,
                isOptional: false
            }
        ])
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})

test('detects binary params and return types', () => {
    const appRoot = makeFixture(`
// @rest
export function reverseBytes(data: Uint8Array): Uint8Array {
    return data
}
`)

    try {
        const [entry] = getExportedFunctionsMetadata(appRoot)

        assert.equal(entry.hasBinaryParams, true)
        assert.equal(entry.hasJsonParams, false)
        assert.equal(entry.returnIsBinary, true)
        assert.equal(entry.mixedParams, false)
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})

test('preserves optional and default parameter information', () => {
    const appRoot = makeFixture(`
// @rest
export function getThing(required: string, optional?: string, withDefault = 'x'): string {
    return required + optional + withDefault
}
`)

    try {
        const [entry] = getExportedFunctionsMetadata(appRoot)

        assert.deepEqual(
            entry.params.map((param) => param.isOptional),
            [false, true, true]
        )
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})

test('rejects binary parameters on GET endpoints', () => {
    const appRoot = makeFixture(`
// @rest
export function getBinary(data: Uint8Array): Uint8Array {
    return data
}
`)

    try {
        assert.throws(
            () => getExportedFunctionsMetadata(appRoot),
            /GET function 'getBinary' cannot have binary parameters/
        )
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})

test('parses @cors, @rateLimit and @sizeLimit markers', () => {
    const appRoot = makeFixture(`
// @rest
// @cors({"allowOrigin": "https://example.test"})
// @rateLimit({"maxRequests": 5})
// @sizeLimit(1mb)
export async function createThing(name: string): Promise<string> {
    return name
}
`)

    try {
        const [entry] = getExportedFunctionsMetadata(appRoot)

        assert.deepEqual(entry.corsConfig, { allowOrigin: 'https://example.test' })
        assert.deepEqual(entry.rateLimitConfig, { maxRequests: 5 })
        assert.equal(entry.sizeLimit, '1mb')
        assert.equal(entry.httpMethod, 'POST')
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})

test('throws when a marker is duplicated on the same function', () => {
    const appRoot = makeFixture(`
// @rest
// @middleware(mid1)
// @middleware(mid2)
export async function getThing(): Promise<string> {
    return 'x'
}
`)

    try {
        assert.throws(
            () => getExportedFunctionsMetadata(appRoot),
            /Only one @middleware\(\.\.\.\) marker is allowed/
        )
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true })
    }
})
