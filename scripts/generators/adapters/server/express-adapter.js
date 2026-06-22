import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesFileTemplatePath = path.resolve(
    __dirname,
    "../templates/server/express-routes-file.template.txt",
);
const routesFileTemplate = fs.readFileSync(routesFileTemplatePath, "utf8");
const routeTemplatePath = path.resolve(
    __dirname,
    "../templates/server/express-route.template.txt",
);
const routeTemplate = fs.readFileSync(routeTemplatePath, "utf8");
const missingParamsTemplatePath = path.resolve(
    __dirname,
    "../templates/server/missing-params.template.txt",
);
const missingParamsTemplate = fs.readFileSync(
    missingParamsTemplatePath,
    "utf8",
);

export function createExpressRouteBody(routeStub) {
    try {
        const paramNames = routeStub.params.map((param) => param.name);
        const functionCall = `${routeStub.serverNamespace}.${routeStub.functionName}(${paramNames.map((name) => `args.${name}`).join(", ")})`;
        const expressMethod = routeStub.httpMethod.toLowerCase();
        const argsExpression =
            routeStub.httpMethod === "GET"
                ? "req.query ?? {}"
                : routeStub.hasBinaryParams
                  ? "decode(req.body) as Record<string, unknown>"
                  : "req.body ?? {}";
        const bodyParserMiddleware =
            routeStub.httpMethod === "GET"
                ? "(req, _res, next) => next()"
                : routeStub.hasBinaryParams
                  ? `express.raw({ type: 'application/msgpack' })`
                  : "express.json()";
        const middlewareFunctionNames =
            (routeStub.middlewares ?? []).length > 0
                ? `, ${(routeStub.middlewares ?? []).map((middlewareName) => `${routeStub.serverNamespace}.${middlewareName}`).join(", ")}`
                : "";

        const sendResultExpression = routeStub.returnIsBinary
            ? `res.set('Content-Type', 'application/msgpack').send(Buffer.from(encode({ result })))`
            : "res.json({ result })";

        const missingParamsBlock =
            paramNames.length > 0
                ? missingParamsTemplate.replaceAll(
                      "{{paramList}}",
                      paramNames.map((name) => `'${name}'`).join(", "),
                  )
                : "";

        return routeTemplate
            .replaceAll("{{expressMethod}}", expressMethod)
            .replaceAll("{{serverAlias}}", routeStub.serverNamespace)
            .replaceAll("{{functionName}}", routeStub.functionName)
            .replaceAll("{{argsExpression}}", argsExpression)
            .replaceAll("{{missingParamsBlock}}", missingParamsBlock)
            .replaceAll("{{functionCall}}", functionCall)
            .replaceAll("{{bodyParserMiddleware}}", bodyParserMiddleware)
            .replaceAll("{{middlewareFunctionNames}}", middlewareFunctionNames)
            .replaceAll("{{sendResultExpression}}", sendResultExpression);
    } catch (error) {
        throw new Error(
            `Failed to create express route body for '${routeStub.functionName}': ${error instanceof Error ? error.message : error}`,
        );
    }
}

export function createExpressRoutesFileContent({
    generatorConfig,
    importsBlock,
    rawCode,
    routesCode,
}) {
    try {
        return routesFileTemplate
            .replaceAll(
                "{{corsOptions}}",
                JSON.stringify(generatorConfig.cors ?? { origin: "*" }),
            )
            .replaceAll(
                "{{errorStatusCodes}}",
                JSON.stringify(generatorConfig.errorStatusCodes ?? {}),
            )
            .replaceAll(
                "{{rateLimitOptions}}",
                JSON.stringify(generatorConfig.rateLimit ?? {}),
            )
            .replaceAll("{{importsLine}}", importsBlock)
            .replaceAll("{{rawCode}}", rawCode)
            .replaceAll("{{routesCode}}", routesCode);
    } catch (error) {
        throw new Error(
            `Failed to create express routes file content: ${error instanceof Error ? error.message : error}`,
        );
    }
}
