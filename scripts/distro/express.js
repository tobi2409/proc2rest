#!/usr/bin/env node

import { runServerGenerator } from '../generators/generate-server.js'
import { createExpressRoutesFileContent } from '../generators/adapters/server/express-adapter/express-adapter.js'

const expressAdapter = {
    createRoutesFileContent: createExpressRoutesFileContent
}

runServerGenerator(expressAdapter)
