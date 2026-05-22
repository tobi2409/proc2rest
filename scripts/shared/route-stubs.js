import * as path from 'path'
import * as fs from 'fs'
import { Project } from 'ts-morph'

import { resolveHttpMethod } from './http-method-resolver.js'

const routeTemplatePath = path.resolve('templates/express-route.template.txt')
const routeTemplate = fs.readFileSync(routeTemplatePath, 'utf8')
const missingParamsTemplatePath = path.resolve('templates/missing-params.template.txt')
const missingParamsTemplate = fs.readFileSync(missingParamsTemplatePath, 'utf8')

export const sourceFilePath = path.resolve('../index-server.ts')

function getProject() {
    const tsConfigPath = path.resolve('tsconfig.json')

    return fs.existsSync(tsConfigPath)
        ? new Project({ tsConfigFilePath: tsConfigPath })
        : new Project()
}

function getSourceFile() {
    const project = getProject()
    project.addSourceFileAtPathIfExists(sourceFilePath)

    const source = project.getSourceFile(sourceFilePath)

    if (!source) {
        throw new Error('Could not find index-server.ts')
    }

    return source
}

function getExportedMethods() {
    const source = getSourceFile()
    const functions = source.getFunctions().filter((fn) => fn.isExported())

    return functions.map((fn) => ({
        name: fn.getName() ?? '<anonymous>',
        isExported: fn.isExported(),
        params: fn.getParameters().map((param) => ({
            name: param.getName(),
            type: param.getType().getText(fn)
        })),
        returnType: fn.getReturnType().getText(fn)
    }))
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

export function getRouteStubs() {
    const methods = getExportedMethods()

    return methods.map((method) => {
        const httpMethod = resolveHttpMethod(method.name)

        return {
            methodName: method.name,
            path: `/api/${method.name}`,
            httpMethod,
            params: method.params,
            routeBody: createRouteBody(method, httpMethod)
        }
    })
}
