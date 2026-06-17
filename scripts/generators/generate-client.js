import * as fs from 'fs'
import * as path from 'path'

import { getExportedFunctionsMetadata } from './shared/exported-functions-metadata.js'
import { getCachedGeneratorConfig } from './shared/generator-config.js'
import { getAppRootPath, getGeneratedClientRootPath, getSrcClientRootPath, getSrcServerRootPath } from './shared/cli-args.js'
import { copySourceTree } from './shared/file-copy.js'
import { getRelativePathFromSrcDir } from './shared/path-utils.js'

const appRootPath = getAppRootPath()
const generatedClientRootPath = getGeneratedClientRootPath(appRootPath)
const srcClientRootPath = getSrcClientRootPath(appRootPath)
const srcServerRootPath = getSrcServerRootPath(appRootPath)
const generatorConfig = getCachedGeneratorConfig(appRootPath)

function createApiClientFiles(clientAdapter, exportedFunctionsMetadata = getExportedFunctionsMetadata(appRootPath)) {
    try {
        const destDir = generatedClientRootPath
        const restFunctionStubs = exportedFunctionsMetadata.filter((stub) => stub.hasRestMarker)

        const servers = generatorConfig.servers ?? []

        for (const serverConfig of servers) {
            const serverSrc = serverConfig?.src

            if (typeof serverSrc !== 'string' || serverSrc.length === 0) {
                throw new Error(`Invalid server entry in config: ${JSON.stringify(serverConfig)}`)
            }

            const relativeServerFile = getRelativePathFromSrcDir(path.join(appRootPath, serverSrc), srcServerRootPath)
            const apiClientsFileName = `${relativeServerFile.replace('.ts', '')}-client.js`
            const clientFilePath = path.join(destDir, apiClientsFileName)
            const clientFileDir = path.dirname(clientFilePath)

            const clientRouteStubs = restFunctionStubs.filter((routeStub) => routeStub.serverFile === relativeServerFile)
            const clientFunctionsBlock = clientRouteStubs
                .map((routeStub) => clientAdapter.createClientFunction(routeStub))
                .join('\n\n')

            const clientApiFileContent = clientAdapter.createClientFileContent({ generatorConfig, clientFunctionsBlock })

            fs.mkdirSync(clientFileDir, { recursive: true })
            fs.writeFileSync(clientFilePath, clientApiFileContent, 'utf8')
        }
    } catch (error) {
        console.error('Error creating API client files:', error instanceof Error ? error.message : error)
        process.exit(1)
    }
}

export function addApiClientImports() {
    try {
        const destDir = generatedClientRootPath
        const jsClients = generatorConfig.jsClients ?? []
        const servers = generatorConfig.servers ?? []
        const serverNamespaceBySrc = {}

        for (const serverConfig of servers) {
            if (typeof serverConfig?.src !== 'string' || typeof serverConfig?.namespace !== 'string') {
                throw new Error(`Invalid server entry in config: ${JSON.stringify(serverConfig)}`)
            }

            const relativeServerFile = getRelativePathFromSrcDir(path.join(appRootPath, serverConfig.src), srcServerRootPath)
            serverNamespaceBySrc[relativeServerFile] = serverConfig.namespace
        }

        for (const clientFileName of jsClients) {
            if (typeof clientFileName !== 'string' || clientFileName.length === 0) {
                throw new Error('Each jsClient entry must be a non-empty string')
            }

            const copiedClientPath = path.join(destDir, path.basename(clientFileName))

            if (!fs.existsSync(copiedClientPath)) {
                throw new Error(`Client file not found in generated directory: ${copiedClientPath}`)
            }

            const sourceClientContent = fs.readFileSync(copiedClientPath, 'utf8')
            const serverImportRegex = /^\s*\/\/\s*@server-import\s+([^\s]+)\s*$/gm
            const importLines = [...sourceClientContent.matchAll(serverImportRegex)]
                .map(([, serverFileName]) => {
                    const serverNamespace = serverNamespaceBySrc[serverFileName]
                    if (!serverNamespace) {
                        throw new Error(`Server '${serverFileName}' not found in config`)
                    }
                    return `import * as ${serverNamespace} from './${serverFileName.replace('.ts', '')}-client.js'`
                })

            const contentWithoutMarkers = sourceClientContent.replace(serverImportRegex, '').trimStart()
            const importsBlock = importLines.join('\n')
            const copiedClientContent = importsBlock.length > 0
                ? `${importsBlock}\n\n${contentWithoutMarkers}`
                : contentWithoutMarkers

            fs.writeFileSync(copiedClientPath, copiedClientContent, 'utf8')
        }
    } catch (error) {
        console.error('Error adding API client imports:', error instanceof Error ? error.message : error)
        process.exit(1)
    }
}

export function runClientGenerator(clientAdapter) {
    try {
        copySourceTree(srcClientRootPath, generatedClientRootPath)
        createApiClientFiles(clientAdapter)
        addApiClientImports()
    } catch (error) {
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
    }
}
