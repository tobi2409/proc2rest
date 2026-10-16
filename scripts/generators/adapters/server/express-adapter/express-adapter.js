import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import Handlebars from 'handlebars'
import { assertValidIdentifier } from '../../../shared/validation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load and compile templates
const routesFileTemplatePath = path.resolve(
    __dirname,
    'templates/express-routes-file.template.txt'
)
const routesFileTemplateSource = fs.readFileSync(routesFileTemplatePath, 'utf8')
const routesFileTemplate = Handlebars.compile(routesFileTemplateSource)

const routeTemplatePath = path.resolve(
    __dirname,
    'templates/express-route.template.txt'
)
const routeTemplateSource = fs.readFileSync(routeTemplatePath, 'utf8')
const routeTemplate = Handlebars.compile(routeTemplateSource)

const missingParamsTemplatePath = path.resolve(
    __dirname,
    'templates/missing-params.template.txt'
)
const missingParamsTemplateSource = fs.readFileSync(
    missingParamsTemplatePath,
    'utf8'
)
const missingParamsTemplate = Handlebars.compile(missingParamsTemplateSource)

const missingAuthorizationParamsTemplatePath = path.resolve(
    __dirname,
    'templates/missing-authorization-params.template.txt'
)

const missingAuthorizationParamsTemplateSource = fs.readFileSync(
    missingAuthorizationParamsTemplatePath,
    'utf8'
)

const missingAuthorizationParamsTemplate = Handlebars.compile(
    missingAuthorizationParamsTemplateSource
)

const missingUrlParamsTemplatePath = path.resolve(
    __dirname,
    'templates/missing-url-params.template.txt'
)

const missingUrlParamsTemplateSource = fs.readFileSync(
    missingUrlParamsTemplatePath,
    'utf8'
)

const missingUrlParamsTemplate = Handlebars.compile(
    missingUrlParamsTemplateSource
)

// Mapping because Express uses different option names than the generator config
function mapCorsConfigToExpressOptions(corsConfig) {
    // corsConfig === null -> CORS is disabled
    if (corsConfig === null) {
        return null
    }

    const resolvedCorsConfig = corsConfig ?? { allowOrigin: '*' }

    return {
        origin: resolvedCorsConfig.allowOrigin,
        methods: resolvedCorsConfig.allowMethods,
        allowedHeaders: resolvedCorsConfig.allowHeaders,
        exposedHeaders: resolvedCorsConfig.exposeHeaders,
        credentials: resolvedCorsConfig.includeCredentials,
        maxAge: resolvedCorsConfig.cacheMaxAgeSeconds,
        preflightContinue: resolvedCorsConfig.continuePreflight,
        optionsSuccessStatus: resolvedCorsConfig.preflightSuccessStatus
    }
}

function mapRateLimitConfigToExpressOptions(rateLimitConfig) {
    if (rateLimitConfig === null) {
        return null
    }

    const resolvedRateLimitConfig = rateLimitConfig ?? {}

    return {
        windowMs: resolvedRateLimitConfig.windowDurationMs,
        max: resolvedRateLimitConfig.maxRequests,
        standardHeaders: resolvedRateLimitConfig.useStandardHeaders,
        legacyHeaders: resolvedRateLimitConfig.useLegacyHeaders,
        message: resolvedRateLimitConfig.responseMessage,
        statusCode: resolvedRateLimitConfig.responseStatusCode,
        skipSuccessfulRequests:
            resolvedRateLimitConfig.ignoreSuccessfulRequests,
        skipFailedRequests: resolvedRateLimitConfig.ignoreFailedRequests
    }
}

function createExpressRouteBody(routeStub, generatorConfig) {
    try {
        assertValidIdentifier(routeStub.serverNamespace, 'server namespace')
        assertValidIdentifier(routeStub.functionName, 'function name')
        for (const middleware of routeStub.middlewares ?? []) {
            assertValidIdentifier(middleware, 'middleware name')
        }

        const normalParams = routeStub.normalParams.map((param) => ({
            name: param.name,
            type: param.type,
            primitiveType: ['string', 'number', 'boolean', 'bigint'].includes(param.type)
                ? param.type
                : undefined,
            isNumber: param.type === 'number',
            isBoolean: param.type === 'boolean',
            isBigInt: param.type === 'bigint',
            isOptional: param.isOptional
        }))

        const authorizationParamNames = routeStub.authorizationParamNames ?? []
        const urlParamNames = routeStub.urlParamNames ?? []

        // Authorization and URL parameters must appear first and in marker order
        const functionArguments = [
            ...authorizationParamNames.map(
                (parameterName, index) =>
                    `authorizationArgs.${parameterName} as Parameters<typeof ${routeStub.serverNamespace}.${routeStub.functionName}>[${index}]`
            ),
            ...urlParamNames.map(
                (parameterName, index) =>
                    `req.params.${parameterName} as Parameters<typeof ${routeStub.serverNamespace}.${routeStub.functionName}>[${authorizationParamNames.length + index}]`
            ),
            ...normalParams.map(
                (param, index) =>
                    `args.${param.name} as Parameters<typeof ${routeStub.serverNamespace}.${routeStub.functionName}>[${authorizationParamNames.length + urlParamNames.length + index}]`
            )
        ]

        const functionCall = `${routeStub.serverNamespace}.${routeStub.functionName}(${functionArguments.join(', ')})`
        const expressMethod = routeStub.httpMethod.toLowerCase()
        const isGet = routeStub.httpMethod === 'GET'
        const middlewareItems = []
        const routeSizeLimit = routeStub.sizeLimit

        const effectiveCorsConfig =
            routeStub.corsConfig !== undefined
                ? routeStub.corsConfig
                : generatorConfig?.cors
        const effectiveRateLimitConfig =
            routeStub.rateLimitConfig !== undefined
                ? routeStub.rateLimitConfig
                : generatorConfig?.rateLimit

        const expressCorsOptions =
            mapCorsConfigToExpressOptions(effectiveCorsConfig)

        const expressRateLimitOptions = mapRateLimitConfigToExpressOptions(
            effectiveRateLimitConfig
        )
        
        // Browser schicken bei vielen Cross-Origin-POSTs zuerst ein OPTIONS-Preflight.
        // Diese Route braucht dieselben CORS-Header wie die eigentliche Endpoint-Route.
        const preflightCorsMiddlewareCode =
            expressCorsOptions !== null
                ? `cors(${JSON.stringify(expressCorsOptions)})`
                : ''

        if (expressCorsOptions !== null) {
            middlewareItems.push(preflightCorsMiddlewareCode)
        }

        if (expressRateLimitOptions !== null) {
            middlewareItems.push(
                `rateLimit(${JSON.stringify(expressRateLimitOptions)})`
            )
        }

        if (!isGet) {
            const hasRouteSizeLimit =
                routeSizeLimit !== undefined && routeSizeLimit !== null
            const limitOptionCode = hasRouteSizeLimit
                ? `limit: ${JSON.stringify(routeSizeLimit)}`
                : ''

            middlewareItems.push(
                routeStub.hasBinaryParams
                    ? `express.raw({ type: 'application/msgpack'${hasRouteSizeLimit ? `, ${limitOptionCode}` : ''} })`
                    : `express.json({ ${limitOptionCode} })`
            )
        }

        middlewareItems.push(
            ...(routeStub.middlewares ?? []).map(
                (middlewareName) =>
                    `${routeStub.serverNamespace}.${middlewareName}`
            )
        )

        const middlewaresArrayCode = middlewareItems.join(', ')

        const missingParamsBlock =
            normalParams.some((param) => !param.isOptional)
                ? missingParamsTemplate({
                      paramList: normalParams
                          .filter((param) => !param.isOptional)
                          .map((param) => `'${param.name}'`)
                          .join(', ')
                  })
                : ''

        const missingAuthorizationParamsBlock =
            authorizationParamNames.length > 0
                ? missingAuthorizationParamsTemplate({
                      paramList: authorizationParamNames
                          .map((parameterName) => `'${parameterName}'`)
                          .join(', ')
                  })
                : ''

        const missingUrlParamsBlock =
            urlParamNames.length > 0
                ? missingUrlParamsTemplate({
                      paramList: urlParamNames
                          .map((parameterName) => `'${parameterName}'`)
                          .join(', ')
                  })
                : ''

        const routePath = routeStub.path.replaceAll(
            /\{([^{}]+)\}/g,
            ':$1'
        )

        return routeTemplate({
            expressMethod,
            routePath,
            isGet,
            hasBinaryParams: routeStub.hasBinaryParams,
            returnIsBinary: routeStub.returnIsBinary,
            missingAuthorizationParamsBlock,
            missingUrlParamsBlock,
            missingParamsBlock,
            functionCall,
            middlewaresArrayCode,
            preflightCorsMiddlewareCode,
            normalParams
        })
    } catch (error) {
        throw new Error(
            `Failed to create express route body for '${routeStub.functionName}': ${error instanceof Error ? error.message : error}`
        )
    }
}

export function createExpressRoutesFileContent({
    generatorConfig,
    importsBlock,
    rawCode,
    exportedFunctionsMetadata
}) {
    try {
        const routesCode = (exportedFunctionsMetadata ?? [])
            .filter((stub) => stub.hasRestMarker)
            .map((stub) => createExpressRouteBody(stub, generatorConfig))
            .join('\n\n')

        return routesFileTemplate({
            corsOptions: JSON.stringify(
                generatorConfig.cors ?? { origin: '*' }
            ),
            errorStatusCodes: JSON.stringify(
                generatorConfig.errorStatusCodes ?? {}
            ),
            rateLimitOptions: JSON.stringify(generatorConfig.rateLimit ?? {}),
            importsLine: importsBlock,
            rawCode,
            routesCode
        })
    } catch (error) {
        throw new Error(
            `Failed to create express routes file content: ${error instanceof Error ? error.message : error}`
        )
    }
}
