import * as path from 'path'
import * as fs from 'fs'
import { Project } from 'ts-morph'

import { resolveHttpMethod } from './http-method-resolver.js'
import { getAppRootPath } from './app-path.js'
import { getGeneratorConfig } from './generator-config.js'

function isBinaryType(typeName, binaryTypes) {
    return binaryTypes.includes(typeName)
}

function getExportedMethods(appRootPath) {
    const generatorConfig = getGeneratorConfig(appRootPath)
    const serverFiles = generatorConfig.servers ?? []
    const binaryTypes = generatorConfig.binaryTypes ?? []
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
            const returnType = fn.getReturnType().getText(fn)
            const params = []
            let hasBinaryParams = false
            let hasJsonParams = false

            for (const param of fn.getParameters()) {
                const paramType = param.getType().getText(fn)
                const currentIsBinary = isBinaryType(paramType, binaryTypes)

                if (currentIsBinary) {
                    hasBinaryParams = true
                } else {
                    hasJsonParams = true
                }

                params.push({
                    name: param.getName(),
                    type: paramType,
                    isBinary: currentIsBinary
                })
            }

            const mixedParams = hasBinaryParams && hasJsonParams

            methods.push({
                name: fn.getName() ?? '<anonymous>',
                serverFile: serverFileName,
                isExported: fn.isExported(),
                params,
                hasBinaryParams,
                hasJsonParams,
                mixedParams,
                returnType,
                returnIsBinary: isBinaryType(returnType, binaryTypes)
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
            params: method.params,
            hasBinaryParams: method.hasBinaryParams,
            hasJsonParams: method.hasJsonParams,
            mixedParams: method.mixedParams,
            returnType: method.returnType,
            returnIsBinary: method.returnIsBinary
        })
    }

    return routeStubs
}
