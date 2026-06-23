import { runServerGenerator } from "../generators/generate-server.js";
import { runClientGenerator } from "../generators/generate-client.js";
import {
    createExpressRouteBody,
    createExpressRoutesFileContent,
} from "../generators/adapters/server/express-adapter/express-adapter.js";
import {
    createFetchClientFunction,
    createFetchClientFileContent,
} from "../generators/adapters/client/fetch-adapter/fetch-adapter.js";

const expressAdapter = {
    createRouteBody: createExpressRouteBody,
    createRoutesFileContent: createExpressRoutesFileContent,
};

const fetchAdapter = {
    createClientFunction: createFetchClientFunction,
    createClientFileContent: createFetchClientFileContent,
};

runServerGenerator(expressAdapter);
runClientGenerator(fetchAdapter);
