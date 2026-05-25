import * as path from 'path'
import * as fs from 'fs'
import { getRouteStubs } from './shared/route-stubs.js'
import { getGeneratorConfig } from './shared/generator-config.js'
import { getAppRootPath } from './shared/app-path.js'

const routesFileTemplatePath = path.resolve('templates/express-routes-file.template.txt')
const routesFileTemplate = fs.readFileSync(routesFileTemplatePath, 'utf8')
const routeTemplatePath = path.resolve('templates/express-route.template.txt')
const routeTemplate = fs.readFileSync(routeTemplatePath, 'utf8')
const missingParamsTemplatePath = path.resolve('templates/missing-params.template.txt')
const missingParamsTemplate = fs.readFileSync(missingParamsTemplatePath, 'utf8')
const generatedPackageTemplatePath = path.resolve('templates/generated-package.template.json')
const generatedPackageTemplate = fs.readFileSync(generatedPackageTemplatePath, 'utf8')
const generatedTsConfigTemplatePath = path.resolve('templates/generated-tsconfig.template.json')
const generatedTsConfigTemplate = fs.readFileSync(generatedTsConfigTemplatePath, 'utf8')

const appRootPath = getAppRootPath()
const routeStubs = getRouteStubs(appRootPath)
const generatorConfig = getGeneratorConfig(appRootPath)

function createRouteBody(routeStub) {
    const paramNames = routeStub.params.map((param) => param.name)
    const methodCall = `${routeStub.methodName}(${paramNames.map((name) => `args.${name}`).join(', ')})`
    const expressMethod = routeStub.httpMethod.toLowerCase()
    const argsExpression = routeStub.httpMethod === 'GET'
        ? 'req.query ?? {}'
        : routeStub.hasBinaryParams
            ? 'decode(req.body) as Record<string, unknown>'
            : 'req.body ?? {}'
    const routeMiddleware = routeStub.httpMethod === 'GET'
        ? '(req, _res, next) => next()'
        : routeStub.hasBinaryParams
            ? `express.raw({ type: 'application/msgpack' })`
            : 'express.json()'

    const sendResultExpression = routeStub.returnIsBinary
        ? `res.set('Content-Type', 'application/msgpack').send(Buffer.from(encode({ result })))`
        : 'res.json({ result })'

    const missingParamsBlock = paramNames.length > 0
        ? missingParamsTemplate.replaceAll('{{paramList}}', paramNames.map((name) => `'${name}'`).join(', '))
        : ''

    return routeTemplate
        .replaceAll('{{expressMethod}}', expressMethod)
        .replaceAll('{{methodName}}', routeStub.methodName)
        .replaceAll('{{argsExpression}}', argsExpression)
        .replaceAll('{{missingParamsBlock}}', missingParamsBlock)
        .replaceAll('{{methodCall}}', methodCall)
        .replaceAll('{{routeMiddleware}}', routeMiddleware)
        .replaceAll('{{sendResultExpression}}', sendResultExpression)
}

function createExpressRoutesFile() {
    const destDir = path.join(appRootPath, 'generated/server')
    const destFilePath = path.join(destDir, 'express-routes.generated.ts')
    const packageJsonPath = path.join(destDir, 'package.json')
    const tsConfigPath = path.join(destDir, 'tsconfig.json')

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
    }

    const serverFiles = generatorConfig.servers ?? []
    const copiedSourceFiles = []

    for (const serverFileName of serverFiles) {
        const sourceFilePath = path.join(appRootPath, serverFileName)
        const copiedSourcePath = path.join(destDir, serverFileName)

        if (!fs.existsSync(sourceFilePath)) {
            throw new Error(`Could not find ${serverFileName}`)
        }

        fs.copyFileSync(sourceFilePath, copiedSourcePath)
        copiedSourceFiles.push(copiedSourcePath)
    }

    // Group method names by server file for named imports
    const methodsByServerFile = {}
    for (const stub of routeStubs) {
        if (!methodsByServerFile[stub.serverFile]) {
            methodsByServerFile[stub.serverFile] = []
        }
        methodsByServerFile[stub.serverFile].push(stub.methodName)
    }

    const importsLines = []
    for (const [serverFileName, methodNames] of Object.entries(methodsByServerFile)) {
        const importPath = serverFileName.replace('.ts', '')
        importsLines.push(`import { ${[...new Set(methodNames)].join(', ')} } from './${importPath}'`)
    }

    const importsBlock = importsLines.join('\n')
    const routesCode = routeStubs.map((stub) => createRouteBody(stub)).join('\n\n')

    const fileContent = routesFileTemplate
        .replaceAll('{{corsOptions}}', JSON.stringify(generatorConfig.cors ?? { origin: '*' }))
        .replaceAll('{{importsLine}}', importsBlock)
        .replaceAll('{{routesCode}}', routesCode)

    fs.writeFileSync(destFilePath, fileContent, 'utf8')
    fs.writeFileSync(packageJsonPath, generatedPackageTemplate, 'utf8')
    fs.writeFileSync(tsConfigPath, generatedTsConfigTemplate, 'utf8')

    return {
        routesFile: destFilePath,
        copiedSourceFiles,
        packageJsonFile: packageJsonPath,
        tsConfigFile: tsConfigPath
    }
}

createExpressRoutesFile()

console.log(JSON.stringify(routeStubs, null, 2))
