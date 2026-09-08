import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import { createFixtureAppRoot, removeFixtureAppRoot } from '../generators/fixture-app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.resolve(__dirname, '../../scripts/distro/express.js')

test('generates an express routes file for the configured @rest server functions', () => {
    const appRoot = createFixtureAppRoot()
    
    try {
        execFileSync(process.execPath, [scriptPath, '--appPath', appRoot], {
            stdio: 'pipe'
        })

        const routesContent = fs.readFileSync(
            path.join(appRoot, 'generated/server/routes.generated.ts'),
            'utf8'
        )

        const routesLines = routesContent.split('\n').map((line) => line.trim())

        assert.ok(
            routesLines.includes(
                "app.get('/api/myServer/getPerson', [cors({\"origin\":\"*\"}), rateLimit({})], async (req: Request, res: Response) => {"
            )
        )

        assert.ok(
            routesLines.includes(
                'const result = await Promise.resolve(myServer.getPerson(args.name as Parameters<typeof myServer.getPerson>[0]))'
            )
        )

        assert.equal(
            fs.existsSync(path.join(appRoot, 'generated/server/logger.ts')),
            true
        )
    } finally {
        removeFixtureAppRoot(appRoot)
    }
})
