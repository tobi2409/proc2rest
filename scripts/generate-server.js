import * as path from 'path'
import * as fs from 'fs'
import { Project } from 'ts-morph'

import { resolveHttpMethod } from './http-method-resolver.js'

const routeTemplatePath = path.resolve('templates/express-route.template.txt')
const routeTemplate = fs.readFileSync(routeTemplatePath, 'utf8')
const missingParamsTemplatePath = path.resolve('templates/missing-params.template.txt')
const missingParamsTemplate = fs.readFileSync(missingParamsTemplatePath, 'utf8')
const routesFileTemplatePath = path.resolve('templates/express-routes-file.template.txt')
const routesFileTemplate = fs.readFileSync(routesFileTemplatePath, 'utf8')
const generatedPackageTemplatePath = path.resolve('templates/generated-package.template.json')
const generatedPackageTemplate = fs.readFileSync(generatedPackageTemplatePath, 'utf8')
const generatedRunnerTemplatePath = path.resolve('templates/generated-runner.template.txt')
const generatedRunnerTemplate = fs.readFileSync(generatedRunnerTemplatePath, 'utf8')
const generatedTsConfigTemplatePath = path.resolve('templates/generated-tsconfig.template.json')
const generatedTsConfigTemplate = fs.readFileSync(generatedTsConfigTemplatePath, 'utf8')

const tsConfigPath = path.resolve('tsconfig.json')

const project = fs.existsSync(tsConfigPath) 
    ? new Project({ tsConfigFilePath: tsConfigPath })
    : new Project()

const sourceFilePath = path.resolve('../index-server.ts')
project.addSourceFileAtPathIfExists(sourceFilePath)

const source = project.getSourceFile(sourceFilePath)

if (!source) {
    console.error('Could not find index-server.ts')
    process.exit(1)
}

let functions = source.getFunctions().filter((fn) => fn.isExported())

const methods = functions.map((fn) => ({
    name: fn.getName() ?? '<anonymous>',
    isExported: fn.isExported(),
    params: fn.getParameters().map((param) => ({
        name: param.getName(),
        type: param.getType().getText(fn)
    })),
    returnType: fn.getReturnType().getText(fn)
}))

function createRouteBody(method, httpMethod) {
    const paramNames = method.params.map((param) => param.name)
    const methodCall = `${method.name}(${paramNames.map((name) => `args.${name}`).join(', ')})`
    const expressMethod = httpMethod.toLowerCase()
    const argsExpression = httpMethod === 'GET' ? 'req.query ?? {}' : 'req.body ?? {}'

    const missingParamsBlock = paramNames.length > 0
        ? missingParamsTemplate.replaceAll('{{paramList}}', paramNames.map((name) => `'${name}'`).join(', '))
        : ''

    return routeTemplate
        .replaceAll('{{expressMethod}}', expressMethod)
        .replaceAll('{{methodName}}', method.name)
        .replaceAll('{{argsExpression}}', argsExpression)
        .replaceAll('{{missingParamsBlock}}', missingParamsBlock)
        .replaceAll('{{methodCall}}', methodCall)
}

const routeStubs = methods.map((method) => {
    const httpMethod = resolveHttpMethod(method.name)

    return {
        methodName: method.name,
        path: `/api/${method.name}`,
        httpMethod,
        routeBody: createRouteBody(method, httpMethod)
    }
})

function createExpressRoutesFile() {
    const destDir = path.resolve('../generated')
    const destFilePath = path.join(destDir, 'express-routes.generated.ts')
    const copiedSourcePath = path.join(destDir, path.basename(sourceFilePath))
    const runnerFilePath = path.join(destDir, 'run-generated.ts')
    const packageJsonPath = path.join(destDir, 'package.json')
    const tsConfigPath = path.join(destDir, 'tsconfig.json')

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
    }

    const methodNames = routeStubs.map((stub) => stub.methodName)
    const importsLine = methodNames.length > 0
        ? `import { ${methodNames.join(', ')} } from './index-server'`
        : ''

    const routesCode = routeStubs.map((stub) => stub.routeBody).join('\n\n')

    const fileContent = routesFileTemplate
        .replaceAll('{{importsLine}}', importsLine)
        .replaceAll('{{routesCode}}', routesCode)

    fs.writeFileSync(destFilePath, fileContent, 'utf8')
    fs.copyFileSync(sourceFilePath, copiedSourcePath)
    fs.writeFileSync(runnerFilePath, generatedRunnerTemplate, 'utf8')
    fs.writeFileSync(packageJsonPath, generatedPackageTemplate, 'utf8')
    fs.writeFileSync(tsConfigPath, generatedTsConfigTemplate, 'utf8')

    return {
        routesFile: destFilePath,
        copiedSourceFile: copiedSourcePath,
        runnerFile: runnerFilePath,
        packageJsonFile: packageJsonPath,
        tsConfigFile: tsConfigPath
    }
}

const generatedFiles = createExpressRoutesFile()

console.log(
  JSON.stringify(
    {
      routeStubs,
            generatedFiles
    },
    null,
    2
  )
)
