import * as path from 'path'
import * as fs from 'fs'
import { Project, ts } from 'ts-morph'

import { resolveHttpMethod } from './http-method-resolver.js'
import { getAppRootPath, getSrcServerRootPath } from './cli-args.js'
import { getCachedGeneratorConfig } from './generator-config.js'
import { getRelativePathFromSrcDir } from './path-utils.js'

function isBinaryType(typeName, binaryTypes) {
    return binaryTypes.includes(typeName)
}

function hasRestMarker(fn) {
    const sourceText = fn.getSourceFile().getFullText()
    const commentRanges = ts.getLeadingCommentRanges(sourceText, fn.getPos()) ?? []
    return commentRanges.some((range) => sourceText.slice(range.pos, range.end).includes('@rest'))
}

function getMiddlewaresFromFunctionComments(fn) {
    try {
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
    } catch (error) {
        throw new Error(`Failed to get middlewares from function comments: ${error instanceof Error ? error.message : error}`)
    }
}

function getExportedFunctions(appRootPath) {
    try {
        const generatorConfig = getCachedGeneratorConfig(appRootPath)
        const serverFiles = generatorConfig.servers ?? []
        const binaryTypes = generatorConfig.binaryTypes ?? []
        const exportedFunctions = []

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
            const srcServerRootPath = getSrcServerRootPath(appRootPath)
            const relativeServerFile = getRelativePathFromSrcDir(sourceFilePath, srcServerRootPath)

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

                exportedFunctions.push({
                    name: fn.getName() ?? '<anonymous>',
                    serverFile: relativeServerFile,
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

        return exportedFunctions
    } catch (error) {
        throw new Error(`Failed to extract exported functions: ${error instanceof Error ? error.message : error}`)
    }
}

export function getExportedFunctionsMetadata(appRootPath = getAppRootPath()) {
    try {
        const generatorConfig = getCachedGeneratorConfig(appRootPath)
        const methodRules = generatorConfig['method-rules'] ?? undefined
        const customFunctions = generatorConfig['method-rules-custom-functions'] ?? undefined
        const exportedFunctions = getExportedFunctions(appRootPath)
        const exportedFunctionsMetadata = []

        for (const func of exportedFunctions) {
            const httpMethod = resolveHttpMethod(func.name, methodRules, customFunctions)

            exportedFunctionsMetadata.push({
                functionName: func.name,
                serverFile: func.serverFile,
                isExported: func.isExported,
                hasRestMarker: func.hasRestMarker,
                path: `/api/${func.name}`,
                httpMethod,
                params: func.params,
                hasBinaryParams: func.hasBinaryParams,
                hasJsonParams: func.hasJsonParams,
                mixedParams: func.mixedParams,
                returnType: func.returnType,
                returnIsBinary: func.returnIsBinary,
                middlewares: func.middlewares
            })
        }

        return exportedFunctionsMetadata
    } catch (error) {
        throw new Error(`Failed to get exported functions metadata: ${error instanceof Error ? error.message : error}`)
    }
}
