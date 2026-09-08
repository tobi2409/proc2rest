import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createFixtureAppRoot, removeFixtureAppRoot } from './fixture-app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptsDir = path.resolve(__dirname, '../../scripts/generators')
const moduleUrl = pathToFileURL(path.join(scriptsDir, 'generate-server.js')).href

const originalArgv = process.argv
let fixturesToClean = []

afterEach(() => {
    process.argv = originalArgv

    for (const dir of fixturesToClean) {
        removeFixtureAppRoot(dir)
    }

    fixturesToClean = []
})

test('runServerGenerator copies the server source tree and writes the generated routes file', async () => {
    const appRoot = createFixtureAppRoot()

    fixturesToClean.push(appRoot)

    process.argv = ['node', 'generate-server.js', '--appPath', appRoot]

    // cache-busting query forces a fresh module evaluation against the new --appPath
    const { runServerGenerator } = await import(`${moduleUrl}?case=copies-and-writes`)

    runServerGenerator({
        createRoutesFileContent: () => 'GENERATED_ROUTES_CONTENT'
    })

    const generatedServerDir = path.join(appRoot, 'generated/server')

    assert.equal(
        fs.readFileSync(path.join(generatedServerDir, 'routes.generated.ts'), 'utf8'),
        'GENERATED_ROUTES_CONTENT'
    )

    assert.equal(fs.existsSync(path.join(generatedServerDir, 'logger.ts')), true)

    assert.equal(
        fs.existsSync(path.join(generatedServerDir, 'first/my-server.ts')),
        true
    )
})

test('runServerGenerator embeds raw server files without copying them', async () => {
    const appRoot = createFixtureAppRoot()

    fixturesToClean.push(appRoot)

    const configPath = path.join(appRoot, 'proc2rest.config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    config.rawServerFiles = ['src/server/raw.ts']
    fs.writeFileSync(configPath, JSON.stringify(config))
    fs.writeFileSync(path.join(appRoot, 'src/server/raw.ts'), 'RAW_SERVER_CODE')

    process.argv = ['node', 'generate-server.js', '--appPath', appRoot]

    const { runServerGenerator } = await import(`${moduleUrl}?case=raw-file`)
    let receivedRawCode

    runServerGenerator({
        createRoutesFileContent: ({ rawCode }) => {
            receivedRawCode = rawCode
            return rawCode
        }
    })

    assert.equal(receivedRawCode, 'RAW_SERVER_CODE')
    assert.equal(
        fs.existsSync(path.join(appRoot, 'generated/server/raw.ts')),
        false
    )
})

test('runServerGenerator exits the process when the source directory is missing', async () => {
    const appRoot = createFixtureAppRoot()

    fixturesToClean.push(appRoot)

    process.argv = ['node', 'generate-server.js', '--appPath', appRoot]

    const { runServerGenerator } = await import(`${moduleUrl}?case=missing-src`)

    fs.rmSync(path.join(appRoot, 'src/server'), { recursive: true, force: true })

    const originalExit = process.exit
    let exitCode
    process.exit = (code) => {
        exitCode = code
    }
    
    try {
        runServerGenerator({ createRoutesFileContent: () => '' })
    } finally {
        process.exit = originalExit
    }

    assert.equal(exitCode, 1)
})
