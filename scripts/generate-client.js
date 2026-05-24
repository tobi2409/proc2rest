import * as fs from 'fs'
import * as path from 'path'

import { getRouteStubs } from './shared/route-stubs.js'
import { getGeneratorConfig } from './shared/generator-config.js'
import { getAppRootPath } from './shared/app-path.js'

const clientFileTemplatePath = path.resolve('templates/client-file.template.txt')
const clientFileTemplate = fs.readFileSync(clientFileTemplatePath, 'utf8')
const clientMethodTemplatePath = path.resolve('templates/client-method.template.txt')
const clientMethodTemplate = fs.readFileSync(clientMethodTemplatePath, 'utf8')
const appRootPath = getAppRootPath()
const generatorConfig = getGeneratorConfig(appRootPath)

function createClientMethod(routeStub) {
    const paramNames = routeStub.params.map((param) => param.name)
    const signatureParams = paramNames.join(', ')
    const paramsObject = paramNames.length > 0
        ? `{ ${paramNames.join(', ')} }`
        : '{}'

    return clientMethodTemplate
        .replaceAll('{{methodName}}', routeStub.methodName)
        .replaceAll('{{signatureParams}}', signatureParams)
        .replaceAll('{{path}}', routeStub.path)
        .replaceAll('{{httpMethod}}', routeStub.httpMethod)
        .replaceAll('{{paramsObject}}', paramsObject)
}

export function createApiClientFile(routeStubs = getRouteStubs(appRootPath)) {
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

    const clientFiles = generatorConfig.clients ?? []
    const generatedClients = []

    for (const clientFile of clientFiles) {
        const clientFileName = clientFile.fileName ?? clientFile.filename
        const servers = clientFile.servers ?? []

        if (typeof clientFileName !== 'string' || clientFileName.length === 0) {
            throw new Error('Each client entry must provide fileName (or filename)')
        }

        const sourceClientPath = path.join(appRootPath, clientFileName)
        const copiedClientPath = path.join(destDir, path.basename(clientFileName))

        if (!fs.existsSync(sourceClientPath)) {
            throw new Error(`Could not find ${clientFileName}`)
        }

        const sourceClientContent = fs.readFileSync(sourceClientPath, 'utf8')
        const scriptTags = []
        const generatedClientFiles = []

        for (const serverFileName of servers) {
            const apiClientsFileName = `${serverFileName}-client.js`
            const clientFilePath = path.join(destDir, apiClientsFileName)
            const clientRouteStubs = routeStubs.filter((routeStub) => routeStub.serverFile === serverFileName)
            const clientMethodsBlock = clientRouteStubs
                .map((routeStub) => createClientMethod(routeStub))
                .join('\n\n')
            const clientApiFileContent = clientFileTemplate
                .replaceAll('{{apiBaseUrl}}', JSON.stringify(generatorConfig.apiUrl ?? 'http://localhost:3000'))
                .replaceAll('{{methodsBlock}}', clientMethodsBlock)

            fs.writeFileSync(clientFilePath, clientApiFileContent, 'utf8')
            scriptTags.push(`    <script src="./${apiClientsFileName}"></script>`)
            generatedClientFiles.push(clientFilePath)
        }

        const copiedClientContent = scriptTags.length > 0
            ? sourceClientContent.includes('</head>')
                ? sourceClientContent.replace('</head>', `${scriptTags.join('\n')}\n</head>`)
                : `${sourceClientContent}\n${scriptTags.join('\n')}\n`
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
