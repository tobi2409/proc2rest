import * as path from 'path'
import * as fs from 'fs'
import { Project, ts } from 'ts-morph'

import { resolveHttpMethod } from './http-method-resolver.js'
import { getAppRootPath } from './app-path.js'
import { getGeneratorConfig } from './generator-config.js'

const generatorConfigCache = new Map()

function getCachedGeneratorConfig(appRootPath) {
    if (!generatorConfigCache.has(appRootPath)) {
        generatorConfigCache.set(appRootPath, getGeneratorConfig(appRootPath))
    }

    return generatorConfigCache.get(appRootPath)
}

function isBinaryType(typeName, binaryTypes) {
    return binaryTypes.includes(typeName)
}

function hasRestMarker(fn) {
    const sourceText = fn.getSourceFile().getFullText()
    const commentRanges = ts.getLeadingCommentRanges(sourceText, fn.getPos()) ?? []
    return commentRanges.some((range) => sourceText.slice(range.pos, range.end).includes('@rest'))
}

function getMiddlewaresFromFunctionComments(fn) {
    const sourceText = fn.getSourceFile().getFullText()
    const commentRanges = ts.getLeadingCommentRanges(sourceText, fn.getPos()) ?? []
    const middlewareNames = []

    for (const range of commentRanges) {
        const commentText = sourceText.slice(range.pos, range.end)
        const middlewareMatches = commentText.matchAll(/@middleware\s*\(([^)]*)\)/g)

        for (const match of middlewareMatches) {
            const middlewareList = (match[1] ?? '')
                .split(',')
                .map((middlewareName) => middlewareName.trim().replace(/^['"]|['"]$/g, ''))
                .filter(Boolean)

            middlewareNames.push(...middlewareList)
        }
    }

    return middlewareNames
}

function getExportedMethods(appRootPath) {
    const generatorConfig = getCachedGeneratorConfig(appRootPath)
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
            const hasRest = hasRestMarker(fn)
            const returnType = fn.getReturnType().getText(fn)
            const params = []
            let hasBinaryParams = false
            let hasJsonParams = false
            const middlewares = getMiddlewaresFromFunctionComments(fn)

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
                hasRestMarker: hasRest,
                params,
                hasBinaryParams,
                hasJsonParams,
                mixedParams,
                returnType,
                returnIsBinary: isBinaryType(returnType, binaryTypes),
                middlewares
            })
        }
    }

    return methods
}

export function getFunctionStubs(appRootPath = getAppRootPath()) {
    const generatorConfig = getCachedGeneratorConfig(appRootPath)
    const methodRules = generatorConfig['method-rules'] ?? undefined
    const customFunctions = generatorConfig['method-rules-custom-functions'] ?? undefined
    const methods = getExportedMethods(appRootPath)
    const functionStubs = []

    for (const method of methods) {
        const httpMethod = resolveHttpMethod(method.name, methodRules, customFunctions)

        functionStubs.push({
            methodName: method.name,
            serverFile: method.serverFile,
            isExported: method.isExported,
            hasRestMarker: method.hasRestMarker,
            path: `/api/${method.name}`,
            httpMethod,
            params: method.params,
            hasBinaryParams: method.hasBinaryParams,
            hasJsonParams: method.hasJsonParams,
            mixedParams: method.mixedParams,
            returnType: method.returnType,
            returnIsBinary: method.returnIsBinary,
            middlewares: method.middlewares
        })
    }

    return functionStubs
}
