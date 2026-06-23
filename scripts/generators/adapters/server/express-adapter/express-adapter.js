import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load and compile templates
const routesFileTemplatePath = path.resolve(
    __dirname,
    "templates/express-routes-file.template.txt",
);
const routesFileTemplateSource = fs.readFileSync(
    routesFileTemplatePath,
    "utf8",
);
const routesFileTemplate = Handlebars.compile(routesFileTemplateSource);

const routeTemplatePath = path.resolve(
    __dirname,
    "templates/express-route.template.txt",
);
const routeTemplateSource = fs.readFileSync(routeTemplatePath, "utf8");
const routeTemplate = Handlebars.compile(routeTemplateSource);

const missingParamsTemplatePath = path.resolve(
    __dirname,
    "templates/missing-params.template.txt",
);
const missingParamsTemplateSource = fs.readFileSync(
    missingParamsTemplatePath,
    "utf8",
);
const missingParamsTemplate = Handlebars.compile(missingParamsTemplateSource);

function createExpressRouteBody(routeStub) {
    try {
        const paramNames = routeStub.params.map((param) => param.name);
        const functionCall = `${routeStub.serverNamespace}.${routeStub.functionName}(${paramNames.map((name) => `args.${name}`).join(", ")})`;
        const expressMethod = routeStub.httpMethod.toLowerCase();
        const isGet = routeStub.httpMethod === "GET";
        const middlewareFunctionNames =
            (routeStub.middlewares ?? []).length > 0
                ? `, ${(routeStub.middlewares ?? []).map((middlewareName) => `${routeStub.serverNamespace}.${middlewareName}`).join(", ")}`
                : "";

        const missingParamsBlock =
            paramNames.length > 0
                ? missingParamsTemplate({
                      paramList: paramNames.map((name) => `'${name}'`).join(", "),
                  })
                : "";

        return routeTemplate({
            expressMethod,
            serverAlias: routeStub.serverNamespace,
            functionName: routeStub.functionName,
            isGet,
            hasBinaryParams: routeStub.hasBinaryParams,
            returnIsBinary: routeStub.returnIsBinary,
            missingParamsBlock,
            functionCall,
            middlewareFunctionNames,
            paramNames: paramNames.length > 0,
        });
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
    exportedFunctionsMetadata,
}) {
    try {
        const routesCode = (exportedFunctionsMetadata ?? [])
            .filter((stub) => stub.hasRestMarker)
            .map((stub) => createExpressRouteBody(stub))
            .join("\n\n");

        return routesFileTemplate({
            corsOptions: JSON.stringify(generatorConfig.cors ?? { origin: "*" }),
            errorStatusCodes: JSON.stringify(generatorConfig.errorStatusCodes ?? {}),
            rateLimitOptions: JSON.stringify(generatorConfig.rateLimit ?? {}),
            importsLine: importsBlock,
            rawCode,
            routesCode,
        });
    } catch (error) {
        throw new Error(
            `Failed to create express routes file content: ${error instanceof Error ? error.message : error}`,
        );
    }
}
