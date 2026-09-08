import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import { createFixtureAppRoot, removeFixtureAppRoot } from '../generators/fixture-app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.resolve(__dirname, '../../scripts/distro/express-fetch.js')

test('generates both the server routes file and the client files in one run', () => {
    const appRoot = createFixtureAppRoot()
    try {
        execFileSync(process.execPath, [scriptPath, '--appPath', appRoot], {
            stdio: 'pipe'
        })

        assert.equal(
            fs.existsSync(path.join(appRoot, 'generated/server/routes.generated.ts')),
            true
        )
        assert.equal(
            fs.existsSync(
                path.join(appRoot, 'generated/client/first/my-server-client.js')
            ),
            true
        )
    } finally {
        removeFixtureAppRoot(appRoot)
    }
})
