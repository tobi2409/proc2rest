import { runServerGenerator } from '../generators/generate-server.js'
import { createExpressRouteBody, createExpressRoutesFileContent } from '../generators/adapters/server/express-adapter.js'

const expressAdapter = {
    createRouteBody: createExpressRouteBody,
    createRoutesFileContent: createExpressRoutesFileContent
}

runServerGenerator(expressAdapter)
