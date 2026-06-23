import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientFileTemplatePath = path.resolve(
    __dirname,
    "templates/client-file.template.txt",
);
const clientFileTemplate = fs.readFileSync(clientFileTemplatePath, "utf8");
const clientFunctionTemplatePath = path.resolve(
    __dirname,
    "templates/client-function.template.txt",
);
const clientFunctionTemplate = fs.readFileSync(
    clientFunctionTemplatePath,
    "utf8",
);

export function createFetchClientFunction(routeStub) {
    try {
        const paramNames = routeStub.params.map((param) => param.name);
        const signatureParams = paramNames.join(", ");
        const paramsObject =
            paramNames.length > 0 ? `{ ${paramNames.join(", ")} }` : "{}";
        const contentType = routeStub.hasBinaryParams
            ? "application/msgpack"
            : "application/json";
        const accept = routeStub.returnIsBinary
            ? "application/msgpack"
            : "application/json";

        return clientFunctionTemplate
            .replaceAll("{{functionName}}", routeStub.functionName)
            .replaceAll("{{signatureParams}}", signatureParams)
            .replaceAll("{{path}}", routeStub.path)
            .replaceAll("{{httpMethod}}", routeStub.httpMethod)
            .replaceAll("{{paramsObject}}", paramsObject)
            .replaceAll("{{contentType}}", contentType)
            .replaceAll("{{accept}}", accept);
    } catch (error) {
        throw new Error(
            `Failed to create fetch client function for '${routeStub.functionName}': ${error instanceof Error ? error.message : error}`,
        );
    }
}

export function createFetchClientFileContent({
    generatorConfig,
    exportedFunctionsMetadata,
    serverFile,
}) {
    try {
        const clientFunctionsBlock = (exportedFunctionsMetadata ?? [])
            .filter((stub) => stub.hasRestMarker)
            .filter((stub) => stub.serverFile === serverFile)
            .map((routeStub) => createFetchClientFunction(routeStub))
            .join("\n\n");

        return clientFileTemplate
            .replaceAll(
                "{{apiBaseUrl}}",
                JSON.stringify(
                    generatorConfig.apiUrl ?? "http://localhost:3000",
                ),
            )
            .replaceAll("{{functionsBlock}}", clientFunctionsBlock);
    } catch (error) {
        throw new Error(
            `Failed to create fetch client file content: ${error instanceof Error ? error.message : error}`,
        );
    }
}
