import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { getExportedFunctionsMetadata } from './shared/exported-functions-metadata.js'
import { getCachedGeneratorConfig } from './shared/generator-config.js'
import { getAppRootPath, getGeneratedServerRootPath, getSrcServerRootPath } from './shared/cli-args.js'
import { copySourceTree } from './shared/file-copy.js'
import { getRelativePathFromSrcDir } from './shared/path-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const routesFileTemplatePath = path.resolve(__dirname, 'templates/server/express-routes-file.template.txt')
const routesFileTemplate = fs.readFileSync(routesFileTemplatePath, 'utf8')
const routeTemplatePath = path.resolve(__dirname, 'templates/server/express-route.template.txt')
const routeTemplate = fs.readFileSync(routeTemplatePath, 'utf8')
const missingParamsTemplatePath = path.resolve(__dirname, 'templates/server/missing-params.template.txt')
const missingParamsTemplate = fs.readFileSync(missingParamsTemplatePath, 'utf8')
const generatedPackageTemplatePath = path.resolve(__dirname, 'templates/config/generated-package.template.json')
const generatedPackageTemplate = fs.readFileSync(generatedPackageTemplatePath, 'utf8')
const generatedTsConfigTemplatePath = path.resolve(__dirname, 'templates/config/generated-tsconfig.template.json')
const generatedTsConfigTemplate = fs.readFileSync(generatedTsConfigTemplatePath, 'utf8')

const appRootPath = getAppRootPath()
const srcServerRootPath = getSrcServerRootPath(appRootPath)
const generatedServerRootPath = getGeneratedServerRootPath(appRootPath)
const exportedFunctionsMetadata = getExportedFunctionsMetadata(appRootPath)
const generatorConfig = getCachedGeneratorConfig(appRootPath)

function createRouteBody(routeStub) {
    try {
        const paramNames = routeStub.params.map((param) => param.name)
        const functionCall = `${routeStub.serverNamespace}.${routeStub.functionName}(${paramNames.map((name) => `args.${name}`).join(', ')})`
        const expressMethod = routeStub.httpMethod.toLowerCase()
        const argsExpression = routeStub.httpMethod === 'GET'
            ? 'req.query ?? {}'
            : routeStub.hasBinaryParams
                ? 'decode(req.body) as Record<string, unknown>'
                : 'req.body ?? {}'
        const bodyParserMiddleware = routeStub.httpMethod === 'GET'
            ? '(req, _res, next) => next()'
            : routeStub.hasBinaryParams
                ? `express.raw({ type: 'application/msgpack' })`
                : 'express.json()'
        const middlewareFunctionNames = (routeStub.middlewares ?? []).length > 0
            ? `, ${(routeStub.middlewares ?? []).map((middlewareName) => `${routeStub.serverNamespace}.${middlewareName}`).join(', ')}`
            : ''

        const sendResultExpression = routeStub.returnIsBinary
            ? `res.set('Content-Type', 'application/msgpack').send(Buffer.from(encode({ result })))`
            : 'res.json({ result })'

        const missingParamsBlock = paramNames.length > 0
            ? missingParamsTemplate.replaceAll('{{paramList}}', paramNames.map((name) => `'${name}'`).join(', '))
            : ''

        return routeTemplate
            .replaceAll('{{expressMethod}}', expressMethod)
            .replaceAll('{{serverAlias}}', routeStub.serverNamespace)
            .replaceAll('{{functionName}}', routeStub.functionName)
            .replaceAll('{{argsExpression}}', argsExpression)
            .replaceAll('{{missingParamsBlock}}', missingParamsBlock)
            .replaceAll('{{functionCall}}', functionCall)
            .replaceAll('{{bodyParserMiddleware}}', bodyParserMiddleware)
            .replaceAll('{{middlewareFunctionNames}}', middlewareFunctionNames)
            .replaceAll('{{sendResultExpression}}', sendResultExpression)
    } catch (error) {
        throw new Error(`Failed to create route body for '${routeStub.functionName}': ${error instanceof Error ? error.message : error}`)
    }
}

function createExpressRoutesFile() {
    try {
        const destDir = generatedServerRootPath
        const destFilePath = path.join(destDir, 'express-routes.generated.ts')
        const packageJsonPath = path.join(destDir, 'package.json')
        const tsConfigPath = path.join(destDir, 'tsconfig.json')

        const importsLines = []
        const configuredServers = generatorConfig.servers ?? []

        for (const serverConfig of configuredServers) {
            const serverSrc = serverConfig.src
            const serverNamespace = serverConfig.namespace
            const absoluteServerFile = path.join(appRootPath, serverSrc)
            const serverFileName = getRelativePathFromSrcDir(absoluteServerFile, srcServerRootPath)
            const importPath = serverFileName.replace(/\.ts$/, '')

            importsLines.push(`import * as ${serverNamespace} from './${importPath}'`)
        }

        const importsBlock = importsLines.join('\n')
        // Only generate routes from stubs with hasRestMarker
        const routesCode = exportedFunctionsMetadata
            .filter((stub) => stub.hasRestMarker)
            .map((stub) => createRouteBody(stub))
            .join('\n\n')

        const rawServerFiles = generatorConfig.rawServerFiles ?? []
        const rawCode = rawServerFiles
            .map((rawFile) => {
                const rawFilePath = path.join(appRootPath, rawFile)
                if (!fs.existsSync(rawFilePath)) {
                    throw new Error(`Could not find raw server file ${rawFile}`)
                }
                return fs.readFileSync(rawFilePath, 'utf8').trim()
            })
            .join('\n\n')

        const fileContent = routesFileTemplate
            .replaceAll('{{corsOptions}}', JSON.stringify(generatorConfig.cors ?? { origin: '*' }))
            .replaceAll('{{importsLine}}', importsBlock)
            .replaceAll('{{rawCode}}', rawCode)
            .replaceAll('{{routesCode}}', routesCode)

        fs.writeFileSync(destFilePath, fileContent, 'utf8')
        fs.writeFileSync(packageJsonPath, generatedPackageTemplate, 'utf8')
        fs.writeFileSync(tsConfigPath, generatedTsConfigTemplate, 'utf8')
    } catch (error) {
        console.error('Error creating express routes file:', error instanceof Error ? error.message : error)
        process.exit(1)
    }
}

try {
    copySourceTree(srcServerRootPath, generatedServerRootPath)
    createExpressRoutesFile()
} catch (error) {
    console.error('Error generating server files:', error instanceof Error ? error.message : error)
    process.exit(1)
}