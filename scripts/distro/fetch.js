import { runClientGenerator } from "../generators/generate-client.js"
import {
    createFetchClientFileContent,
} from "../generators/adapters/client/fetch-adapter/fetch-adapter.js"

const fetchAdapter = {
    createClientFileContent: createFetchClientFileContent,
};

runClientGenerator(fetchAdapter)
