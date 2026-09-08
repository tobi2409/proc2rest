#!/usr/bin/env node

import { runClientGenerator } from '../generators/generate-client.js'
import {
    createFetchClientFileContent,
    createFetchClientRuntimeFileContent
} from '../generators/adapters/client/fetch-adapter/fetch-adapter.js'

const fetchAdapter = {
    createClientFileContent: createFetchClientFileContent,
    createClientRuntimeFileContent: createFetchClientRuntimeFileContent
}

runClientGenerator(fetchAdapter)
