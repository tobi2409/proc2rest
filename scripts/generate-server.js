import * as path from 'path'
import * as fs from 'fs'
import { getRouteStubs } from './shared/route-stubs.js'
import { getGeneratorConfig } from './shared/generator-config.js'
import { getAppRootPath } from './shared/app-path.js'

const routesFileTemplatePath = path.resolve('templates/express-routes-file.template.txt')
const routesFileTemplate = fs.readFileSync(routesFileTemplatePath, 'utf8')
const generatedPackageTemplatePath = path.resolve('templates/generated-package.template.json')
const generatedPackageTemplate = fs.readFileSync(generatedPackageTemplatePath, 'utf8')
const generatedTsConfigTemplatePath = path.resolve('templates/generated-tsconfig.template.json')
const generatedTsConfigTemplate = fs.readFileSync(generatedTsConfigTemplatePath, 'utf8')

const appRootPath = getAppRootPath()
const routeStubsByKey = getRouteStubs(appRootPath)
const generatorConfig = getGeneratorConfig(appRootPath)

function createExpressRoutesFile() {
    const destDir = path.join(appRootPath, 'generated/server')
    const destFilePath = path.join(destDir, 'express-routes.generated.ts')
    const packageJsonPath = path.join(destDir, 'package.json')
    const tsConfigPath = path.join(destDir, 'tsconfig.json')

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
    }

    const targets = generatorConfig.targets ?? ['index']
    const copiedSourceFiles = []
    const importsLines = []

    for (const key of targets) {
        const serverFileName = `${key}-server.ts`
        const sourceFilePath = path.join(appRootPath, serverFileName)
        const copiedSourcePath = path.join(destDir, serverFileName)

        if (!fs.existsSync(sourceFilePath)) {
            throw new Error(`Could not find ${serverFileName}`)
        }

        fs.copyFileSync(sourceFilePath, copiedSourcePath)
        copiedSourceFiles.push(copiedSourcePath)

        const methodNames = [...new Set((routeStubsByKey[key] ?? []).map((stub) => stub.methodName))]

        if (methodNames.length > 0) {
            importsLines.push(`import { ${methodNames.join(', ')} } from './${serverFileName.replace('.ts', '')}'`)
        }
    }

    const routesBodies = []
    for (const [key, stubs] of Object.entries(routeStubsByKey)) {
        for (const stub of stubs) {
            routesBodies.push(stub.routeBody)
        }
    }

    const importsBlock = importsLines.join('\n')
    const routesCode = routesBodies.join('\n\n')

    const fileContent = routesFileTemplate
        .replaceAll('{{corsOptions}}', JSON.stringify(generatorConfig.cors ?? { origin: '*' }))
        .replaceAll('{{importsLine}}', importsBlock)
        .replaceAll('{{routesCode}}', routesCode)

    fs.writeFileSync(destFilePath, fileContent, 'utf8')
    fs.writeFileSync(packageJsonPath, generatedPackageTemplate, 'utf8')
    fs.writeFileSync(tsConfigPath, generatedTsConfigTemplate, 'utf8')

    return {
        routesFile: destFilePath,
        copiedSourceFiles,
        packageJsonFile: packageJsonPath,
        tsConfigFile: tsConfigPath
    }
}

createExpressRoutesFile()

console.log(JSON.stringify(routeStubsByKey, null, 2))
