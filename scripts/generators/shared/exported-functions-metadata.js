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
    const commentRanges =
        ts.getLeadingCommentRanges(sourceText, fn.getPos()) ?? []
    // some(...) ist true, sobald mindestens ein Kommentar "@rest" enthält.
    return commentRanges.some((range) =>
        sourceText.slice(range.pos, range.end).includes('@rest')
    )
}

function getSingleMarkerRawArgument(fn, markerName) {
    try {
        const sourceText = fn.getSourceFile().getFullText()
        const commentRanges =
            ts.getLeadingCommentRanges(sourceText, fn.getPos()) ?? []
        const allLeadingComments = commentRanges
            .map((range) => sourceText.slice(range.pos, range.end))
            .join('\n')
        const markerRegex = new RegExp(`@${markerName}\\s*\\(([^)]*)\\)`, 'g')
        const matches = [...allLeadingComments.matchAll(markerRegex)]

        if (matches.length > 1) {
            throw new Error(
                `Only one @${markerName}(...) marker is allowed per function`
            )
        }

        if (matches.length === 0) {
            return undefined
        }

        const rawArg = (matches[0]?.[1] ?? '').trim()

        if (rawArg.length === 0) {
            throw new Error(`@${markerName}(...) requires a value`)
        }

        return rawArg
    } catch (error) {
        throw new Error(
            `Failed to read @${markerName}(...) marker: ${error instanceof Error ? error.message : error}`
        )
    }
}

function getMiddlewaresFromFunctionComments(fn) {
    try {
        const rawMiddlewareArg = getSingleMarkerRawArgument(fn, 'middleware')

        // getSingleMarkerRawArgument gibt undefined zurück, sollte kein @middleware(...) Marker vorhanden sein.
        if (rawMiddlewareArg === undefined) {
            return []
        }

        return (
            rawMiddlewareArg
                .split(',')
                .map((middlewareName) =>
                    middlewareName.trim().replace(/^['"]|['"]$/g, '')
                )
                // Entferne leere Strings nach trim() und quote-Entfernung
                .filter((name) => name.length > 0)
        )
    } catch (error) {
        throw new Error(
            `Failed to get middlewares from function comments: ${error instanceof Error ? error.message : error}`
        )
    }
}

function getCorsConfigFromFunctionComments(fn) {
    try {
        const rawCorsConfig = getSingleMarkerRawArgument(fn, 'cors')

        if (rawCorsConfig === undefined) {
            return undefined
        }

        return JSON.parse(rawCorsConfig)
    } catch (error) {
        throw new Error(
            `Failed to get cors config from function comments: ${error instanceof Error ? error.message : error}`
        )
    }
}

function getRateLimitConfigFromFunctionComments(fn) {
    try {
        const rawRateLimitConfig = getSingleMarkerRawArgument(fn, 'rateLimit')

        if (rawRateLimitConfig === undefined) {
            return undefined
        }

        return JSON.parse(rawRateLimitConfig)
    } catch (error) {
        throw new Error(
            `Failed to get rateLimit config from function comments: ${error instanceof Error ? error.message : error}`
        )
    }
}

function getSizeLimitFromFunctionComments(fn) {
    try {
        const rawSizeLimit = getSingleMarkerRawArgument(fn, 'sizeLimit')

        if (rawSizeLimit === undefined) {
            return undefined
        }

        try {
            return JSON.parse(rawSizeLimit)
        } catch {
            return rawSizeLimit
        }
    } catch (error) {
        throw new Error(
            `Failed to get sizeLimit from function comments: ${error instanceof Error ? error.message : error}`
        )
    }
}

export function getExportedFunctionsMetadata(appRootPath = getAppRootPath()) {
    try {
        const generatorConfig = getCachedGeneratorConfig(appRootPath)
        const servers = generatorConfig.servers ?? []
        const binaryTypes = generatorConfig.binaryTypes ?? []
        const methodRules = generatorConfig['method-rules'] ?? undefined
        const customFunctions =
            generatorConfig['method-rules-custom-functions'] ?? undefined
        const exportedFunctionsMetadata = []
        const tsConfigPath = path.join(appRootPath, 'tsconfig.json')
        const project = fs.existsSync(tsConfigPath)
            ? new Project({ tsConfigFilePath: tsConfigPath })
            : new Project()

        for (const serverConfig of servers) {
            const serverSrc = serverConfig.src
            const serverNamespace = serverConfig.namespace
            const sourceFilePath = path.join(appRootPath, serverSrc)

            project.addSourceFileAtPathIfExists(sourceFilePath)

            const source = project.getSourceFile(sourceFilePath)

            if (!source) {
                throw new Error(`Could not find ${serverSrc}`)
            }

            const functions = source
                .getFunctions()
                .filter((fn) => fn.isExported())
            const srcServerRootPath = getSrcServerRootPath(appRootPath)
            const relativeServerFile = getRelativePathFromSrcDir(
                sourceFilePath,
                srcServerRootPath
            )

            for (const fn of functions) {
                const functionName = fn.getName() ?? '<anonymous>'
                const hasRest = hasRestMarker(fn)
                const returnType = fn.getReturnType().getText(fn)
                const params = []
                let hasBinaryParams = false
                let hasJsonParams = false
                const middlewares = getMiddlewaresFromFunctionComments(fn)
                const corsConfig = getCorsConfigFromFunctionComments(fn)
                const rateLimitConfig =
                    getRateLimitConfigFromFunctionComments(fn)
                const sizeLimit = getSizeLimitFromFunctionComments(fn)

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
                const httpMethod = resolveHttpMethod(
                    functionName,
                    methodRules,
                    customFunctions
                )

                exportedFunctionsMetadata.push({
                    functionName,
                    serverFile: relativeServerFile,
                    serverNamespace,
                    isExported: fn.isExported(),
                    hasRestMarker: hasRest,
                    path: `/api/${serverNamespace}/${functionName}`,
                    httpMethod,
                    params,
                    hasBinaryParams,
                    hasJsonParams,
                    mixedParams,
                    returnType,
                    returnIsBinary: isBinaryType(returnType, binaryTypes),
                    middlewares,
                    corsConfig,
                    rateLimitConfig,
                    sizeLimit
                })
            }
        }

        return exportedFunctionsMetadata
    } catch (error) {
        throw new Error(
            `Failed to extract exported function metadata: ${error instanceof Error ? error.message : error}`
        )
    }
}
