import * as path from 'path'
import * as fs from 'fs'
import { Project, ts } from 'ts-morph'

import { resolveHttpMethod } from './http-method-resolver.js'
import { getAppRootPath, getSrcServerRootPath } from './cli-args.js'
import { getCachedGeneratorConfig } from './generator-config.js'
import { getRelativePathFromSrcDir } from './path-utils.js'
import { assertValidIdentifier } from './validation.js'

function isBinaryType(typeName, binaryTypes) {
    if (binaryTypes.includes(typeName)) {
        return true
    }

    const promiseType = typeName.match(/^Promise<(.+)>$/)
    return promiseType ? isBinaryType(promiseType[1], binaryTypes) : false
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
        const rawMiddlewares = getSingleMarkerRawArgument(fn, 'middlewares')

        if (rawMiddlewares === undefined) {
            return []
        }

        const middlewares = JSON.parse(rawMiddlewares)

        if (
            !Array.isArray(middlewares) ||
            middlewares.some((middlewareName) => typeof middlewareName !== 'string')
        ) {
            throw new Error(
                '@middlewares(...) requires an array of middleware names'
            )
        }

        return middlewares
    } catch (error) {
        throw new Error(
            `Failed to get middlewares from function comments: ${error instanceof Error ? error.message : error}`
        )
    }
}

function getUrlFromFunctionComments(fn) {
    try {
        const rawUrl = getSingleMarkerRawArgument(fn, 'url')

        if (rawUrl === undefined) {
            return undefined
        }

        // Parsing enforces the quoted @url("...") syntax and handles JSON escapes correctly.
        const url = JSON.parse(rawUrl)

        if (typeof url !== 'string' || url.length === 0) {
            throw new Error('@url(...) requires a non-empty string')
        }

        return url
    } catch (error) {
        throw new Error(
            `Failed to get url from function comments: ${error instanceof Error ? error.message : error}`
        )
    }
}

function getUrlParamNamesFromFunctionComments(fn) {
    const url = getUrlFromFunctionComments(fn)

    if (url === undefined) {
        return []
    }

    const urlParamNames = [...url.matchAll(/\{([^{}]+)\}/g)].map(
        (match) => match[1]
    )

    if (new Set(urlParamNames).size !== urlParamNames.length) {
        throw new Error('@url(...) cannot contain duplicate parameter names')
    }

    return urlParamNames
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

function getAuthorizationParamNamesFromFunctionComments(fn) {
    try {
        const rawAuthorizationParams = getSingleMarkerRawArgument(
            fn,
            'authorizationParams'
        )

        if (rawAuthorizationParams === undefined) {
            return []
        }

        const authorizationParamNames = JSON.parse(rawAuthorizationParams)

        if (
            !Array.isArray(authorizationParamNames) ||
            authorizationParamNames.some(
                (parameterName) => typeof parameterName !== 'string'
            )
        ) {
            throw new Error(
                '@authorizationParams(...) requires an array of parameter names'
            )
        }

        if (new Set(authorizationParamNames).size !== authorizationParamNames.length) {
            throw new Error(
                '@authorizationParams(...) cannot contain duplicate parameter names'
            )
        }

        return authorizationParamNames
    } catch (error) {
        throw new Error(
            `Failed to get authorizationParams from function comments: ${error instanceof Error ? error.message : error}`
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
            assertValidIdentifier(serverNamespace, 'server namespace')

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
                const authorizationParamNames =
                    getAuthorizationParamNamesFromFunctionComments(fn)
                const url = getUrlFromFunctionComments(fn)
                const urlParamNames = getUrlParamNamesFromFunctionComments(fn)
                const functionParams = fn.getParameters()
                // This reserved prefix contains authorization params followed by URL params, not normal params.
                const leadingParamNames = functionParams
                    .slice(
                        0,
                        authorizationParamNames.length + urlParamNames.length
                    )
                    .map((param) => param.getName())
                const expectedLeadingParamNames = [
                    ...authorizationParamNames,
                    ...urlParamNames
                ]

                if (
                    expectedLeadingParamNames.some(
                        (parameterName, index) =>
                            leadingParamNames[index] !== parameterName
                    )
                ) {
                    throw new Error(
                        `Authorization and URL parameters of '${functionName}' must appear first and in marker order`
                    )
                }

                const authorizationParamNameSet = new Set(
                    authorizationParamNames
                )
                
                const urlParamNameSet = new Set(urlParamNames)
                
                const normalParams = []
                let hasBinaryParams = false
                let hasJsonParams = false
                const middlewares = getMiddlewaresFromFunctionComments(fn)

                for (const middleware of middlewares) {
                    assertValidIdentifier(middleware, 'middleware name')
                }
                
                const corsConfig = getCorsConfigFromFunctionComments(fn)
                const rateLimitConfig =
                    getRateLimitConfigFromFunctionComments(fn)
                const sizeLimit = getSizeLimitFromFunctionComments(fn)

                for (const param of functionParams) {
                    if (
                        authorizationParamNameSet.has(param.getName()) ||
                        urlParamNameSet.has(param.getName())
                    ) {
                        continue
                    }

                    const paramType = param.getType().getText(fn)
                    const currentIsBinary = isBinaryType(paramType, binaryTypes)

                    if (currentIsBinary) {
                        hasBinaryParams = true
                    } else {
                        hasJsonParams = true
                    }

                    normalParams.push({
                        name: param.getName(),
                        type: paramType,
                        isBinary: currentIsBinary,
                        isOptional: param.isOptional() || param.hasInitializer()
                    })
                }

                const mixedParams = hasBinaryParams && hasJsonParams
                const httpMethod = resolveHttpMethod(
                    functionName,
                    methodRules,
                    customFunctions
                )

                if (hasRest && httpMethod === 'GET' && hasBinaryParams) {
                    throw new Error(
                        `GET function '${functionName}' cannot have binary parameters`
                    )
                }

                exportedFunctionsMetadata.push({
                    functionName,
                    serverFile: relativeServerFile,
                    serverNamespace,
                    isExported: fn.isExported(),
                    hasRestMarker: hasRest,
                    path: `/api/${serverNamespace}/${url ?? functionName}`,
                    httpMethod,
                    authorizationParamNames,
                    urlParamNames,
                    normalParams,
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
