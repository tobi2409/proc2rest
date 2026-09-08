import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createExpressRoutesFileContent } from '../../../../../scripts/generators/adapters/server/express-adapter/express-adapter.js'

function makeStub(overrides = {}) {
    return {
        functionName: 'getPerson',
        serverNamespace: 'myServer',
        serverFile: 'first/my-server.ts',
        hasRestMarker: true,
        httpMethod: 'GET',
        params: [{ name: 'name', type: 'string', isBinary: false }],
        hasBinaryParams: false,
        hasJsonParams: true,
        mixedParams: false,
        returnIsBinary: false,
        middlewares: [],
        corsConfig: undefined,
        rateLimitConfig: undefined,
        sizeLimit: undefined,
        ...overrides
    }
}

test('generates a GET route with a missing-params guard and the function call', () => {
    const content = createExpressRoutesFileContent({
        generatorConfig: {},
        importsBlock: "import * as myServer from './first/my-server'",
        rawCode: '',
        exportedFunctionsMetadata: [makeStub()]
    })

    const lines = content.split('\n').map((line) => line.trim())

    assert.ok(
        lines.includes(
            "app.get('/api/myServer/getPerson', [cors({\"origin\":\"*\"}), rateLimit({})], async (req: Request, res: Response) => {"
        )
    )
    
    assert.ok(
        lines.includes("const missingParams = ['name'].filter((name) => !(name in args))")
    )
    
    assert.ok(
        lines.includes('const result = await Promise.resolve(myServer.getPerson(args.name as Parameters<typeof myServer.getPerson>[0]))')
    )
})

test('excludes functions that are not marked with @rest', () => {
    const content = createExpressRoutesFileContent({
        generatorConfig: {},
        importsBlock: '',
        rawCode: '',
        exportedFunctionsMetadata: [makeStub({ hasRestMarker: false })]
    })

    assert.equal(content.includes('getPerson'), false)
})

test('adds express.raw middleware and msgpack encoding for binary routes', () => {
    const content = createExpressRoutesFileContent({
        generatorConfig: {},
        importsBlock: '',
        rawCode: '',
        exportedFunctionsMetadata: [
            makeStub({
                functionName: 'reverseBytes',
                httpMethod: 'POST',
                hasBinaryParams: true,
                hasJsonParams: false,
                returnIsBinary: true,
                params: [{ name: 'data', type: 'Uint8Array', isBinary: true }]
            })
        ]
    })

    const lines = content.split('\n').map((line) => line.trim())

    assert.ok(
        lines.includes(
            "app.post('/api/myServer/reverseBytes', [cors({\"origin\":\"*\"}), rateLimit({}), express.raw({ type: 'application/msgpack' })], async (req: Request, res: Response) => {"
        )
    )

    assert.ok(
        lines.includes(
            "res.set('Content-Type', 'application/msgpack').send(Buffer.from(encode({ result })))"
        )
    )
})

test('adds express.json middleware for POST routes', () => {
    const content = createExpressRoutesFileContent({
        generatorConfig: {},
        importsBlock: '',
        rawCode: '',
        exportedFunctionsMetadata: [
            makeStub({ functionName: 'addPerson', httpMethod: 'POST' })
        ]
    })

    const lines = content.split('\n').map((line) => line.trim())

    assert.ok(
        lines.includes(
            "app.post('/api/myServer/addPerson', [cors({\"origin\":\"*\"}), rateLimit({}), express.json({  })], async (req: Request, res: Response) => {"
        )
    )
})

test('converts GET number and boolean query parameters before validation', () => {
    const content = createExpressRoutesFileContent({
        generatorConfig: {},
        importsBlock: '',
        rawCode: '',
        exportedFunctionsMetadata: [
            makeStub({
                functionName: 'getCount',
                params: [
                    { name: 'count', type: 'number', isBinary: false, isOptional: false },
                    { name: 'includeArchived', type: 'boolean', isBinary: false, isOptional: true }
                ]
            })
        ]
    })

    const lines = content.split('\n').map((line) => line.trim())

    assert.ok(lines.includes("args.count = Number(args.count)"))
    assert.ok(lines.includes("if (args.includeArchived === 'true') args.includeArchived = true"))
    assert.ok(lines.includes("if (args.includeArchived === 'false') args.includeArchived = false"))
    assert.ok(lines.includes("if ('count' in args && (typeof args.count !== 'number' || !Number.isFinite(args.count))) {"))
    assert.ok(lines.includes("if ('includeArchived' in args && (typeof args.includeArchived !== 'boolean')) {"))
    assert.ok(
        lines.includes(
            "await writeLog('WARN', 'Invalid parameter type', { method: req.method, path: req.path, parameter: 'count', expectedType: 'number', actualType: typeof args.count })"
        )
    )
    assert.ok(lines.includes("const missingParams = ['count'].filter((name) => !(name in args))"))
})

test('applies cors and rate limit middleware when configured on the route', () => {
    const content = createExpressRoutesFileContent({
        generatorConfig: {},
        importsBlock: '',
        rawCode: '',
        exportedFunctionsMetadata: [
            makeStub({
                corsConfig: { allowOrigin: 'https://example.test' },
                rateLimitConfig: { maxRequests: 5 }
            })
        ]
    })

    const lines = content.split('\n').map((line) => line.trim())

    assert.ok(
        lines.includes(
            "app.options('/api/myServer/getPerson', [cors({\"origin\":\"https://example.test\"})], (_req: Request, res: Response) => {"
        )
    )

    assert.ok(
        lines.includes(
            "app.get('/api/myServer/getPerson', [cors({\"origin\":\"https://example.test\"}), rateLimit({\"max\":5})], async (req: Request, res: Response) => {"
        )
    )
})

test('omits cors middleware when corsConfig is explicitly disabled', () => {
    const content = createExpressRoutesFileContent({
        generatorConfig: { cors: { allowOrigin: '*' } },
        importsBlock: '',
        rawCode: '',
        exportedFunctionsMetadata: [makeStub({ corsConfig: null })]
    })

    const lines = content.split('\n').map((line) => line.trim())

    assert.ok(
        lines.includes(
            "app.get('/api/myServer/getPerson', [rateLimit({})], async (req: Request, res: Response) => {"
        )
    )
})

test('adds a final error handler that logs details and returns a generic message', () => {
    const content = createExpressRoutesFileContent({
        generatorConfig: {},
        importsBlock: '',
        rawCode: '',
        exportedFunctionsMetadata: [makeStub()]
    })

    assert.match(content, /app\.use\(async \(error: unknown, req: Request, res: Response,/)
    assert.match(content, /errorStack/)
    assert.match(content, /await writeLog\('ERROR', 'Unhandled request error'/)
    assert.match(content, /res\.status\(httpStatus\)\.json\(\{ error: 'Request failed' \}\)/)
})
