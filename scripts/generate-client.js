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

export function createApiClientFile(routeStubsByKey = getRouteStubs(appRootPath)) {
    const destDir = path.join(appRootPath, 'generated/client')

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
    }

    const allRouteStubs = Object.values(routeStubsByKey).flatMap((stubs) => stubs)
    const methodsBlock = allRouteStubs
        .map((routeStub) => createClientMethod(routeStub))
        .join('\n\n')

    const fileContent = clientFileTemplate
        .replaceAll('{{apiBaseUrl}}', JSON.stringify(generatorConfig.apiUrl ?? 'http://localhost:3000'))
        .replaceAll('{{methodsBlock}}', methodsBlock)

    const targets = generatorConfig.targets ?? ['index']
    const generatedClients = []

    for (const key of targets) {
        const clientFileName = `${key}.html`
        const clientFilePath = path.join(destDir, `${key}-api-clients.js`)
        const sourceClientPath = path.join(appRootPath, clientFileName)
        const copiedClientPath = path.join(destDir, `${key}-${path.basename(clientFileName)}`)

        if (!fs.existsSync(sourceClientPath)) {
            throw new Error(`Could not find ${clientFileName}`)
        }

        fs.writeFileSync(clientFilePath, fileContent, 'utf8')

        const sourceClientContent = fs.readFileSync(sourceClientPath, 'utf8')
        const scriptTag = `  <script type="module" src="./${path.basename(clientFilePath)}"></script>`
        const copiedClientContent = sourceClientContent.includes('</head>')
            ? sourceClientContent.replace('</head>', `${scriptTag}\n</head>`)
            : `${sourceClientContent}\n${scriptTag}\n`

        fs.writeFileSync(copiedClientPath, copiedClientContent, 'utf8')

        generatedClients.push({
            key,
            clientFile: clientFilePath,
            copiedClientFile: copiedClientPath,
            routeCount: allRouteStubs.length
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
