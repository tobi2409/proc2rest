#!/usr/bin/env node

import { runServerGenerator } from '../generators/generate-server.js'
import { runClientGenerator } from '../generators/generate-client.js'
import { createExpressRoutesFileContent } from '../generators/adapters/server/express-adapter/express-adapter.js'
import {
    createFetchClientFileContent,
    createFetchClientRuntimeFileContent
} from '../generators/adapters/client/fetch-adapter/fetch-adapter.js'

const expressAdapter = {
    createRoutesFileContent: createExpressRoutesFileContent
}

const fetchAdapter = {
    createClientFileContent: createFetchClientFileContent,
    createClientRuntimeFileContent: createFetchClientRuntimeFileContent
}

runServerGenerator(expressAdapter)
runClientGenerator(fetchAdapter)
