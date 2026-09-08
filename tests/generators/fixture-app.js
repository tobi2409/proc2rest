import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// Minimal but realistic app fixture (config + server + client source) used by the
// generator/distro integration tests to exercise the real generation pipeline.
export function createFixtureAppRoot() {
    const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proc2rest-fixture-'))

    fs.mkdirSync(path.join(appRoot, 'src/server/first'), { recursive: true })
    fs.mkdirSync(path.join(appRoot, 'src/client'), { recursive: true })

    fs.writeFileSync(
        path.join(appRoot, 'proc2rest.config.json'),
        JSON.stringify(
            {
                jsClients: ['src/client/index.js'],
                servers: [
                    { src: 'src/server/first/my-server.ts', namespace: 'myServer' }
                ],
                apiUrl: 'http://localhost:3000'
            },
            null,
            4
        )
    )

    fs.writeFileSync(
        path.join(appRoot, 'src/server/first/my-server.ts'),
        `// @rest\nexport async function getPerson(name: string): Promise<string> {\n    return name\n}\n`
    )

    fs.writeFileSync(
        path.join(appRoot, 'src/client/index.js'),
        `// @server-import first/my-server.ts\nconsole.log('client loaded')\n`
    )

    return appRoot
}

export function removeFixtureAppRoot(appRoot) {
    fs.rmSync(appRoot, { recursive: true, force: true })
}
