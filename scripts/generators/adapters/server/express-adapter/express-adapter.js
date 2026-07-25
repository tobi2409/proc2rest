import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import Handlebars from 'handlebars'

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
        const paramNames = routeStub.params.map((param) => param.name)
        const functionCall = `${routeStub.serverNamespace}.${routeStub.functionName}(${paramNames.map((name) => `args.${name}`).join(', ')})`
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
            paramNames.length > 0
                ? missingParamsTemplate({
                      paramList: paramNames
                          .map((name) => `'${name}'`)
                          .join(', ')
                  })
                : ''

        return routeTemplate({
            expressMethod,
            serverAlias: routeStub.serverNamespace,
            functionName: routeStub.functionName,
            isGet,
            hasBinaryParams: routeStub.hasBinaryParams,
            returnIsBinary: routeStub.returnIsBinary,
            missingParamsBlock,
            functionCall,
            middlewaresArrayCode,
            preflightCorsMiddlewareCode,
            paramNames: paramNames.length > 0
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
