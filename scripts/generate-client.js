import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { getExportedFunctionsMetadata } from './shared/exported-functions-metadata.js'
import { getCachedGeneratorConfig } from './shared/generator-config.js'
import { getAppRootPath, getGeneratedClientRootPath, getSrcClientRootPath, getSrcServerRootPath } from './shared/cli-args.js'
import { copySourceTree } from './shared/file-copy.js'
import { getRelativePathFromSrcDir } from './shared/path-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const clientFileTemplatePath = path.resolve(__dirname, 'templates/client/client-file.template.txt')
const clientFileTemplate = fs.readFileSync(clientFileTemplatePath, 'utf8')
const clientFunctionTemplatePath = path.resolve(__dirname, 'templates/client/client-function.template.txt')
const clientFunctionTemplate = fs.readFileSync(clientFunctionTemplatePath, 'utf8')
const appRootPath = getAppRootPath()
const generatedClientRootPath = getGeneratedClientRootPath(appRootPath)
const srcClientRootPath = getSrcClientRootPath(appRootPath)
const srcServerRootPath = getSrcServerRootPath(appRootPath)
const generatorConfig = getCachedGeneratorConfig(appRootPath)

function createClientFunction(routeStub) {
    try {
        const paramNames = routeStub.params.map((param) => param.name)
        const signatureParams = paramNames.join(', ')
        const paramsObject = paramNames.length > 0
            ? `{ ${paramNames.join(', ')} }`
            : '{}'
        const contentType = routeStub.hasBinaryParams
            ? 'application/msgpack'
            : 'application/json'
        const accept = routeStub.returnIsBinary
            ? 'application/msgpack'
            : 'application/json'

        return clientFunctionTemplate
            .replaceAll('{{functionName}}', routeStub.functionName)
            .replaceAll('{{signatureParams}}', signatureParams)
            .replaceAll('{{path}}', routeStub.path)
            .replaceAll('{{httpMethod}}', routeStub.httpMethod)
            .replaceAll('{{paramsObject}}', paramsObject)
            .replaceAll('{{contentType}}', contentType)
            .replaceAll('{{accept}}', accept)
    } catch (error) {
        throw new Error(`Failed to create client function for '${routeStub.functionName}': ${error instanceof Error ? error.message : error}`)
    }
}

export function createApiClientFiles(exportedFunctionsMetadata = getExportedFunctionsMetadata(appRootPath)) {
    try {
        const destDir = generatedClientRootPath
        const restFunctionStubs = exportedFunctionsMetadata.filter((stub) => stub.hasRestMarker)

        const serverFileNames = generatorConfig.servers ?? []

        for (const serverFileName of serverFileNames) {
            const relativeServerFile = getRelativePathFromSrcDir(path.join(appRootPath, serverFileName), srcServerRootPath)
            const apiClientsFileName = `${relativeServerFile.replace('.ts', '')}-client.js`
            const clientFilePath = path.join(destDir, apiClientsFileName)
            const clientFileDir = path.dirname(clientFilePath)

            const clientRouteStubs = restFunctionStubs.filter((routeStub) => routeStub.serverFile === relativeServerFile)
            const clientFunctionsBlock = clientRouteStubs
                .map((routeStub) => createClientFunction(routeStub))
                .join('\n\n')

            const clientApiFileContent = clientFileTemplate
                .replaceAll('{{apiBaseUrl}}', JSON.stringify(generatorConfig.apiUrl ?? 'http://localhost:3000'))
                .replaceAll('{{functionsBlock}}', clientFunctionsBlock)

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

        for (const clientFileName of jsClients) {
            if (typeof clientFileName !== 'string' || clientFileName.length === 0) {
                throw new Error('Each jsClient entry must be a non-empty string')
            }

            const copiedClientPath = path.join(destDir, path.basename(clientFileName))

            if (!fs.existsSync(copiedClientPath)) {
                throw new Error(`Client file not found in generated directory: ${copiedClientPath}`)
            }

            const sourceClientContent = fs.readFileSync(copiedClientPath, 'utf8')
            const serverImportRegex = /^\s*\/\/\s*@server-import\s+([^\s]+)\s+as\s+([A-Za-z_$][\w$]*)\s*$/gm
            const importLines = [...sourceClientContent.matchAll(serverImportRegex)]
                .map(([, serverFileName, alias]) => `import * as ${alias} from './${serverFileName.replace('.ts', '')}-client.js'`)

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

try {
    copySourceTree(srcClientRootPath, generatedClientRootPath)
    createApiClientFiles()
    addApiClientImports()
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
}
