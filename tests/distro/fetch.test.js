import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import { createFixtureAppRoot, removeFixtureAppRoot } from '../generators/fixture-app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.resolve(__dirname, '../../scripts/distro/fetch.js')

test('generates a fetch client file with a function for each @rest server function', () => {
    const appRoot = createFixtureAppRoot()

    try {
        execFileSync(process.execPath, [scriptPath, '--appPath', appRoot], {
            stdio: 'pipe'
        })

        const clientContent = fs.readFileSync(
            path.join(appRoot, 'generated/client/first/my-server-client.js'),
            'utf8'
        )

        const clientLines = clientContent.split('\n').map((line) => line.trim())

        assert.ok(clientLines.includes('export async function getPerson(name) {'))
        assert.ok(
            clientLines.includes(
                "return request('/api/myServer/getPerson', 'GET', {}, { name }, 'application/json', 'application/json')"
            )
        )

        const indexContent = fs.readFileSync(
            path.join(appRoot, 'generated/client/index.js'),
            'utf8'
        )
        
        const indexLines = indexContent.split('\n').map((line) => line.trim())

        assert.ok(
            indexLines.includes(
                "import * as myServer from './first/my-server-client.js'"
            )
        )
    } finally {
        removeFixtureAppRoot(appRoot)
    }
})
