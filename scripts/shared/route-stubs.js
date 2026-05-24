import * as path from 'path'
import * as fs from 'fs'
import { Project } from 'ts-morph'

import { resolveHttpMethod } from './http-method-resolver.js'
import { getAppRootPath } from './app-path.js'
import { getGeneratorConfig } from './generator-config.js'

function getExportedMethods(appRootPath) {
    const generatorConfig = getGeneratorConfig(appRootPath)
    const serverFiles = generatorConfig.servers ?? []
    const methods = []

    for (const serverFileName of serverFiles) {
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

        for (const fn of functions) {
            methods.push({
                name: fn.getName() ?? '<anonymous>',
                serverFile: serverFileName,
                isExported: fn.isExported(),
                params: fn.getParameters().map((param) => ({
                    name: param.getName(),
                    type: param.getType().getText(fn)
                })),
                returnType: fn.getReturnType().getText(fn)
            })
        }
    }

    return methods
}

export function getRouteStubs(appRootPath = getAppRootPath()) {
    const methods = getExportedMethods(appRootPath)
    const routeStubs = []

    for (const method of methods) {
        const httpMethod = resolveHttpMethod(method.name)

        routeStubs.push({
            methodName: method.name,
            serverFile: method.serverFile,
            path: `/api/${method.name}`,
            httpMethod,
            params: method.params
        })
    }

    return routeStubs
}
