import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createFixtureAppRoot, removeFixtureAppRoot } from './fixture-app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptsDir = path.resolve(__dirname, '../../scripts/generators')
const moduleUrl = pathToFileURL(path.join(scriptsDir, 'generate-client.js')).href

const originalArgv = process.argv
let fixturesToClean = []

afterEach(() => {
    process.argv = originalArgv

    for (const dir of fixturesToClean) {
        removeFixtureAppRoot(dir)
    }

    fixturesToClean = []
})

test('runClientGenerator copies the client tree, writes api client files and rewires server imports', async () => {
    const appRoot = createFixtureAppRoot()

    fixturesToClean.push(appRoot)
    // generate-client.js reads --appPath from process.argv at import time, not as a function argument
    process.argv = ['node', 'generate-client.js', '--appPath', appRoot]

    // "?case=..." is just an arbitrary label to give this import a unique URL, so the
    // ESM module cache treats it as a new module instance instead of the already-imported one
    const { runClientGenerator } = await import(`${moduleUrl}?case=full-run`)

    runClientGenerator({
        createClientFileContent: () =>
            'export async function getPerson(name) { return name }'
    })

    const generatedClientDir = path.join(appRoot, 'generated/client')

    const indexContent = fs.readFileSync(
        path.join(generatedClientDir, 'index.js'),
        'utf8'
    )

    const indexLines = indexContent.split('\n').map((line) => line.trim())

    assert.ok(
        indexLines.includes(
            "import * as myServer from './first/my-server-client.js'"
        )
    )

    assert.equal(
        fs.readFileSync(
            path.join(generatedClientDir, 'first/my-server-client.js'),
            'utf8'
        ),
        'export async function getPerson(name) { return name }'
    )
})

test('runClientGenerator exits the process when a configured client file is missing', async () => {
    const appRoot = createFixtureAppRoot()

    fixturesToClean.push(appRoot)

    fs.writeFileSync(
        path.join(appRoot, 'proc2rest.config.json'),
        JSON.stringify({
            jsClients: ['src/client/missing.js'],
            servers: [
                { src: 'src/server/first/my-server.ts', namespace: 'myServer' }
            ],
            apiUrl: 'http://localhost:3000'
        })
    )

    process.argv = ['node', 'generate-client.js', '--appPath', appRoot]

    const { runClientGenerator } = await import(`${moduleUrl}?case=missing-client-file`)

    const originalExit = process.exit
    let exitCode
    process.exit = (code) => {
        exitCode = code
    }
    
    try {
        runClientGenerator({ createClientFileContent: () => '' })
    } finally {
        process.exit = originalExit
    }

    assert.equal(exitCode, 1)
})
