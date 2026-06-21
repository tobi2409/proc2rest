import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { getExportedFunctionsMetadata } from './shared/exported-functions-metadata.js'
import { getCachedGeneratorConfig } from './shared/generator-config.js'
import { getAppRootPath, getGeneratedServerRootPath, getSrcServerRootPath } from './shared/cli-args.js'
import { copySourceTree } from './shared/file-copy.js'
import { getRelativePathFromSrcDir } from './shared/path-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const generatedTsConfigTemplatePath = path.resolve(__dirname, 'adapters/templates/config/generated-tsconfig.template.json')
const generatedTsConfigTemplate = fs.readFileSync(generatedTsConfigTemplatePath, 'utf8')
// Logger is adapter-independent, so the template is handled directly in generate-server.
const loggerTemplatePath = path.resolve(__dirname, 'adapters/templates/server/logger.template.txt')
const loggerTemplate = fs.readFileSync(loggerTemplatePath, 'utf8')

const appRootPath = getAppRootPath()
const srcServerRootPath = getSrcServerRootPath(appRootPath)
const generatedServerRootPath = getGeneratedServerRootPath(appRootPath)
const exportedFunctionsMetadata = getExportedFunctionsMetadata(appRootPath)
const generatorConfig = getCachedGeneratorConfig(appRootPath)

function generateRoutesFile(serverAdapter) {
    try {
        const destDir = generatedServerRootPath
        const destFilePath = path.join(destDir, 'express-routes.generated.ts')
        const loggerFilePath = path.join(destDir, 'logger.generated.ts')
        const tsConfigPath = path.join(destDir, 'tsconfig.json')

        const importsLines = []
        const configuredServers = generatorConfig.servers ?? []

        for (const serverConfig of configuredServers) {
            const serverSrc = serverConfig.src
            const serverNamespace = serverConfig.namespace
            const absoluteServerFile = path.join(appRootPath, serverSrc)
            const serverFileName = getRelativePathFromSrcDir(absoluteServerFile, srcServerRootPath)
            const importPath = serverFileName.replace(/\.ts$/, '')

            importsLines.push(`import * as ${serverNamespace} from './${importPath}'`)
        }

        const importsBlock = importsLines.join('\n')
        const routesCode = exportedFunctionsMetadata
            .filter((stub) => stub.hasRestMarker)
            .map((stub) => serverAdapter.createRouteBody(stub))
            .join('\n\n')

        const rawServerFiles = generatorConfig.rawServerFiles ?? []
        const rawCode = rawServerFiles
            .map((rawFile) => {
                const rawFilePath = path.join(appRootPath, rawFile)
                if (!fs.existsSync(rawFilePath)) {
                    throw new Error(`Could not find raw server file ${rawFile}`)
                }
                return fs.readFileSync(rawFilePath, 'utf8').trim()
            })
            .join('\n\n')

        const fileContent = serverAdapter.createRoutesFileContent({ generatorConfig, importsBlock, rawCode, routesCode })

        fs.writeFileSync(destFilePath, fileContent, 'utf8')
        fs.writeFileSync(loggerFilePath, loggerTemplate, 'utf8')
        fs.writeFileSync(tsConfigPath, generatedTsConfigTemplate, 'utf8')
    } catch (error) {
        console.error('Error generating routes file:', error instanceof Error ? error.message : error)
        process.exit(1)
    }
}

export function runServerGenerator(serverAdapter) {
    try {
        copySourceTree(srcServerRootPath, generatedServerRootPath)
        generateRoutesFile(serverAdapter)
    } catch (error) {
        console.error('Error generating server files:', error instanceof Error ? error.message : error)
        process.exit(1)
    }
}
