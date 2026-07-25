import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import Handlebars from 'handlebars'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load and compile templates
const clientFileTemplatePath = path.resolve(
    __dirname,
    'templates/client-file.template.txt'
)
const clientFileTemplateSource = fs.readFileSync(clientFileTemplatePath, 'utf8')
const clientFileTemplate = Handlebars.compile(clientFileTemplateSource)

const clientFunctionTemplatePath = path.resolve(
    __dirname,
    'templates/client-function.template.txt'
)
const clientFunctionTemplateSource = fs.readFileSync(
    clientFunctionTemplatePath,
    'utf8'
)
const clientFunctionTemplate = Handlebars.compile(clientFunctionTemplateSource)

export function createFetchClientFunction(routeStub) {
    try {
        const paramNames = routeStub.params.map((param) => param.name)
        const signatureParams = paramNames.join(', ')
        const hasParams = paramNames.length > 0

        return clientFunctionTemplate({
            functionName: routeStub.functionName,
            signatureParams,
            path: routeStub.path,
            httpMethod: routeStub.httpMethod,
            hasParams,
            hasBinaryParams: routeStub.hasBinaryParams,
            returnIsBinary: routeStub.returnIsBinary,
            paramNames
        })
    } catch (error) {
        throw new Error(
            `Failed to create fetch client function for '${routeStub.functionName}': ${error instanceof Error ? error.message : error}`
        )
    }
}

export function createFetchClientFileContent({
    generatorConfig,
    exportedFunctionsMetadata,
    serverFile
}) {
    try {
        const clientFunctionsBlock = (exportedFunctionsMetadata ?? [])
            .filter((stub) => stub.hasRestMarker)
            .filter((stub) => stub.serverFile === serverFile)
            .map((routeStub) => createFetchClientFunction(routeStub))
            .join('\n\n')

        return clientFileTemplate({
            apiBaseUrl: JSON.stringify(
                generatorConfig.apiUrl ?? 'http://localhost:3000'
            ),
            functionsBlock: clientFunctionsBlock
        })
    } catch (error) {
        throw new Error(
            `Failed to create fetch client file content: ${error instanceof Error ? error.message : error}`
        )
    }
}
