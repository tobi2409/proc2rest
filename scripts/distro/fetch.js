import { runClientGenerator } from "../generators/generate-client.js"
import {
    createFetchClientFunction,
    createFetchClientFileContent,
} from "../generators/adapters/client/fetch-adapter.js"

const fetchAdapter = {
    createClientFunction: createFetchClientFunction,
    createClientFileContent: createFetchClientFileContent,
};

runClientGenerator(fetchAdapter)
