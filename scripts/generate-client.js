import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { getExportedFunctionsMetadata } from './shared/exported-functions-metadata.js'
import { getGeneratorConfig } from './shared/generator-config.js'
import { getAppRootPath, getGeneratedClientRootPath } from './shared/cli-args.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const clientFileTemplatePath = path.resolve(__dirname, 'templates/client/client-file.template.txt')
const clientFileTemplate = fs.readFileSync(clientFileTemplatePath, 'utf8')
const clientFunctionTemplatePath = path.resolve(__dirname, 'templates/client/client-function.template.txt')
const clientFunctionTemplate = fs.readFileSync(clientFunctionTemplatePath, 'utf8')
const appRootPath = getAppRootPath()
const generatedClientRootPath = getGeneratedClientRootPath(appRootPath)
const generatorConfig = getGeneratorConfig(appRootPath)

function createClientFunction(routeStub) {
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
}

export function createApiClientFile(exportedFunctionsMetadata = getExportedFunctionsMetadata(appRootPath)) {
    const destDir = generatedClientRootPath
    const restFunctionStubs = exportedFunctionsMetadata.filter((stub) => stub.hasRestMarker)

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
    }

    const functionsBlock = restFunctionStubs
        .map((routeStub) => createClientFunction(routeStub))
        .join('\n\n')

    const fileContent = clientFileTemplate
        .replaceAll('{{apiBaseUrl}}', JSON.stringify(generatorConfig.apiUrl ?? 'http://localhost:3000'))
        .replaceAll('{{functionsBlock}}', functionsBlock)

    const clients = generatorConfig.clients ?? []
    const generatedClients = []

    for (const client of clients) {
        const clientFileName = client.fileName ?? client.filename
        const servers = client.servers ?? []

        if (typeof clientFileName !== 'string' || clientFileName.length === 0) {
            throw new Error('Each client entry must provide fileName (or filename)')
        }

        const sourceClientPath = path.join(appRootPath, clientFileName)
        const copiedClientPath = path.join(destDir, path.basename(clientFileName))

        if (!fs.existsSync(sourceClientPath)) {
            throw new Error(`Could not find ${clientFileName}`)
        }

        if (servers.length > 0 && path.extname(clientFileName).toLowerCase() !== '.js') {
            throw new Error(`Client file ${clientFileName} must be a .js file when servers are configured`)
        }

        const sourceClientContent = fs.readFileSync(sourceClientPath, 'utf8')
        const importApiLine = []
        const generatedClientFiles = []

        for (const serverFileName of servers) {
            const apiClientsFileName = `${serverFileName}-client.js`
            const clientFilePath = path.join(destDir, apiClientsFileName)
            const clientRouteStubs = restFunctionStubs.filter((routeStub) => routeStub.serverFile === serverFileName)
            const functionNames = [...new Set(clientRouteStubs.map((routeStub) => routeStub.functionName))]
            const clientFunctionsBlock = clientRouteStubs
                .map((routeStub) => createClientFunction(routeStub))
                .join('\n\n')
            const clientApiFileContent = clientFileTemplate
                .replaceAll('{{apiBaseUrl}}', JSON.stringify(generatorConfig.apiUrl ?? 'http://localhost:3000'))
                .replaceAll('{{functionsBlock}}', clientFunctionsBlock)

            fs.writeFileSync(clientFilePath, clientApiFileContent, 'utf8')
            if (functionNames.length > 0) {
                importApiLine.push(`import { ${functionNames.join(', ')} } from './${apiClientsFileName}'`)
            }
            
            generatedClientFiles.push(clientFilePath)
        }

        const copiedClientContent = importApiLine.length > 0
            ? `${importApiLine.join('\n')}\n\n${sourceClientContent}`
            : sourceClientContent

        fs.writeFileSync(copiedClientPath, copiedClientContent, 'utf8')

        generatedClients.push({
            clientFiles: generatedClientFiles,
            copiedClientFile: copiedClientPath,
            routeCount: restFunctionStubs.length
        })
    }

    return { generatedClients }
}

try {
    const generatedFiles = createApiClientFile()
    console.log(JSON.stringify({ generatedFiles }, null, 2))
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
}
