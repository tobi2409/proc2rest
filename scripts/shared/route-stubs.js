import * as path from 'path'
import * as fs from 'fs'
import { Project } from 'ts-morph'

import { resolveHttpMethod } from './http-method-resolver.js'
import { getAppRootPath } from './app-path.js'
import { getGeneratorConfig } from './generator-config.js'

const routeTemplatePath = path.resolve('templates/express-route.template.txt')
const routeTemplate = fs.readFileSync(routeTemplatePath, 'utf8')
const missingParamsTemplatePath = path.resolve('templates/missing-params.template.txt')
const missingParamsTemplate = fs.readFileSync(missingParamsTemplatePath, 'utf8')

function getExportedMethods(appRootPath) {
    const generatorConfig = getGeneratorConfig(appRootPath)
    const targets = generatorConfig.targets ?? ['index']

    const exportedMethodsByKey = {}

    for (const key of targets) {
        const serverFileName = `${key}-server.ts`
        const sourceFilePath = path.join(appRootPath, serverFileName)
        const tsConfigPath = path.join(appRootPath, 'tsconfig.json')
        const project = fs.existsSync(tsConfigPath)
            ? new Project({ tsConfigFilePath: tsConfigPath })
            : new Project()

        project.addSourceFileAtPathIfExists(sourceFilePath)

        const source = project.getSourceFile(sourceFilePath)

        if (!source) {
            throw new Error(`Could not find ${serverFileName}`)
        }

        const functions = source.getFunctions().filter((fn) => fn.isExported())

        exportedMethodsByKey[key] = {
            server: serverFileName,
            methods: functions.map((fn) => ({
                name: fn.getName() ?? '<anonymous>',
                isExported: fn.isExported(),
                params: fn.getParameters().map((param) => ({
                    name: param.getName(),
                    type: param.getType().getText(fn)
                })),
                returnType: fn.getReturnType().getText(fn)
            }))
        }
    }

    return exportedMethodsByKey
}

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

export function getRouteStubs(appRootPath = getAppRootPath()) {
    const methodsByKey = getExportedMethods(appRootPath)
    const routeStubsByKey = {}

    for (const [key, entry] of Object.entries(methodsByKey)) {
        routeStubsByKey[key] = []

        for (const method of entry.methods) {
            const httpMethod = resolveHttpMethod(method.name)

            routeStubsByKey[key].push({
                methodName: method.name,
                path: `/api/${key}/${method.name}`,
                httpMethod,
                params: method.params,
                routeBody: createRouteBody(method, httpMethod)
            })
        }
    }

    return routeStubsByKey
}
