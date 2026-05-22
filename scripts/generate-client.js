import * as fs from 'fs'
import * as path from 'path'

import { getRouteStubs } from './shared/route-stubs.js'

const clientFileTemplatePath = path.resolve('templates/client-file.template.txt')
const clientFileTemplate = fs.readFileSync(clientFileTemplatePath, 'utf8')
const clientMethodTemplatePath = path.resolve('templates/client-method.template.txt')
const clientMethodTemplate = fs.readFileSync(clientMethodTemplatePath, 'utf8')

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

export function createApiClientFile(routeStubs = getRouteStubs()) {
    const destDir = path.resolve('../generated/client')
    const destFilePath = path.join(destDir, 'index-api-clients.js')
    const sourceIndexHtmlPath = path.resolve('../index.html')
    const copiedIndexHtmlPath = path.join(destDir, 'index.html')

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
    }

    const methodsBlock = routeStubs
        .map((routeStub) => createClientMethod(routeStub))
        .join('\n\n')

    const fileContent = clientFileTemplate.replaceAll('{{methodsBlock}}', methodsBlock)
    fs.writeFileSync(destFilePath, fileContent, 'utf8')

    if (!fs.existsSync(sourceIndexHtmlPath)) {
        throw new Error('Could not find index.html')
    }

    fs.copyFileSync(sourceIndexHtmlPath, copiedIndexHtmlPath)

    return {
        clientFile: destFilePath,
        copiedIndexHtmlFile: copiedIndexHtmlPath,
        routeCount: routeStubs.length
    }
}

try {
    const generatedFiles = createApiClientFile()
    console.log(JSON.stringify({ generatedFiles }, null, 2))
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
}
