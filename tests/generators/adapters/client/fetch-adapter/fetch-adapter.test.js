import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    createFetchClientFunction,
    createFetchClientFileContent,
    createFetchClientRuntimeFileContent
} from '../../../../../scripts/generators/adapters/client/fetch-adapter/fetch-adapter.js'

function makeStub(overrides = {}) {
    return {
        functionName: 'getPerson',
        serverFile: 'first/my-server.ts',
        hasRestMarker: true,
        httpMethod: 'GET',
        path: '/api/myServer/getPerson',
        authorizationParamNames: [],
        normalParams: [{ name: 'name', type: 'string', isBinary: false }],
        hasBinaryParams: false,
        returnIsBinary: false,
        ...overrides
    }
}

test('generates a client function calling request with the path, method and params', () => {
    const code = createFetchClientFunction(makeStub())

    const lines = code.split('\n').map((line) => line.trim())

    assert.ok(lines.includes('export async function getPerson(name) {'))
    assert.ok(
        lines.includes(
            "return request('/api/myServer/getPerson', 'GET', {}, { name }, 'application/json', 'application/json')"
        )
    )
})

test('uses msgpack content types for binary params and return values', () => {
    const code = createFetchClientFunction(
        makeStub({
            functionName: 'reverseBytes',
            httpMethod: 'POST',
            path: '/api/myServer/reverseBytes',
            normalParams: [{ name: 'data', type: 'Uint8Array', isBinary: true }],
            hasBinaryParams: true,
            returnIsBinary: true
        })
    )

    const lines = code.split('\n').map((line) => line.trim())

    assert.ok(
        lines.includes(
            "return request('/api/myServer/reverseBytes', 'POST', {}, { data }, 'application/msgpack', 'application/msgpack')"
        )
    )
})

test('passes authorization params before normal params', () => {
    const code = createFetchClientFunction(
        makeStub({
            functionName: 'createThing',
            httpMethod: 'POST',
            authorizationParamNames: ['token', 'tenant'],
            normalParams: [{ name: 'name', type: 'string' }]
        })
    )

    const lines = code.split('\n').map((line) => line.trim())

    assert.ok(
        lines.includes('export async function createThing(token, tenant, name) {')
    )
    
    assert.ok(
        lines.includes(
            "return request('/api/myServer/getPerson', 'POST', { token, tenant }, { name }, 'application/json', 'application/json')"
        )
    )
})

test('createFetchClientFileContent includes only @rest functions for the given server file', () => {
    const content = createFetchClientFileContent({
        generatorConfig: { apiUrl: 'https://example.test' },
        exportedFunctionsMetadata: [
            makeStub(),
            makeStub({ functionName: 'internalOnly', hasRestMarker: false }),
            makeStub({ functionName: 'otherServerFn', serverFile: 'second/other.ts' })
        ],
        serverFile: 'first/my-server.ts'
    })

    const lines = content.split('\n').map((line) => line.trim())

    assert.ok(lines.includes("import { request } from '../proc2rest-client.js'"))
    assert.ok(lines.includes('export async function getPerson(name) {'))
    assert.equal(content.includes('internalOnly'), false)
    assert.equal(content.includes('otherServerFn'), false)
    assert.equal(content.includes('function getMsgPackModule'), false)
})

test('creates one shared client runtime with request and msgpack loading', () => {
    const content = createFetchClientRuntimeFileContent({
        generatorConfig: { apiUrl: 'https://example.test' }
    })

    assert.match(content, /const API_BASE_URL = "https:\/\/example\.test"/)
    assert.match(content, /async function getMsgPackModule\(\)/)
    assert.match(content, /export async function request\(/)
    assert.match(content, /Authorization: JSON\.stringify\(authenticationParams\)/)
})
