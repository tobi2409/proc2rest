import * as fs from 'fs'
import * as path from 'path'

import { getFunctionStubs } from './shared/function-stubs.js'
import { getGeneratorConfig } from './shared/generator-config.js'
import { getAppRootPath } from './shared/app-path.js'

const clientFileTemplatePath = path.resolve('templates/client/client-file.template.txt')
const clientFileTemplate = fs.readFileSync(clientFileTemplatePath, 'utf8')
const clientMethodTemplatePath = path.resolve('templates/client/client-method.template.txt')
const clientMethodTemplate = fs.readFileSync(clientMethodTemplatePath, 'utf8')
const appRootPath = getAppRootPath()
const generatorConfig = getGeneratorConfig(appRootPath)

function createClientMethod(routeStub) {
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

    return clientMethodTemplate
        .replaceAll('{{methodName}}', routeStub.methodName)
        .replaceAll('{{signatureParams}}', signatureParams)
        .replaceAll('{{path}}', routeStub.path)
        .replaceAll('{{httpMethod}}', routeStub.httpMethod)
        .replaceAll('{{paramsObject}}', paramsObject)
        .replaceAll('{{contentType}}', contentType)
        .replaceAll('{{accept}}', accept)
}

export function createApiClientFile(routeStubs = getFunctionStubs(appRootPath)) {
    const destDir = path.join(appRootPath, 'generated/client')

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
    }

    const methodsBlock = routeStubs
        .map((routeStub) => createClientMethod(routeStub))
        .join('\n\n')

    const fileContent = clientFileTemplate
        .replaceAll('{{apiBaseUrl}}', JSON.stringify(generatorConfig.apiUrl ?? 'http://localhost:3000'))
        .replaceAll('{{methodsBlock}}', methodsBlock)

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
            const clientRouteStubs = routeStubs.filter((routeStub) => routeStub.serverFile === serverFileName)
            const methodNames = [...new Set(clientRouteStubs.map((routeStub) => routeStub.methodName))]
            const clientMethodsBlock = clientRouteStubs
                .map((routeStub) => createClientMethod(routeStub))
                .join('\n\n')
            const clientApiFileContent = clientFileTemplate
                .replaceAll('{{apiBaseUrl}}', JSON.stringify(generatorConfig.apiUrl ?? 'http://localhost:3000'))
                .replaceAll('{{methodsBlock}}', clientMethodsBlock)

            fs.writeFileSync(clientFilePath, clientApiFileContent, 'utf8')
            if (methodNames.length > 0) {
                importApiLine.push(`import { ${methodNames.join(', ')} } from './${apiClientsFileName}'`)
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
            routeCount: routeStubs.length
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
