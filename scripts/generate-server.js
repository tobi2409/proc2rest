import * as path from 'path'
import * as fs from 'fs'
import { getRouteStubs, sourceFilePath } from './shared/route-stubs.js'

const routesFileTemplatePath = path.resolve('templates/express-routes-file.template.txt')
const routesFileTemplate = fs.readFileSync(routesFileTemplatePath, 'utf8')
const generatedPackageTemplatePath = path.resolve('templates/generated-package.template.json')
const generatedPackageTemplate = fs.readFileSync(generatedPackageTemplatePath, 'utf8')
const generatedRunnerTemplatePath = path.resolve('templates/generated-runner.template.txt')
const generatedRunnerTemplate = fs.readFileSync(generatedRunnerTemplatePath, 'utf8')
const generatedTsConfigTemplatePath = path.resolve('templates/generated-tsconfig.template.json')
const generatedTsConfigTemplate = fs.readFileSync(generatedTsConfigTemplatePath, 'utf8')

const routeStubs = getRouteStubs()

function createExpressRoutesFile() {
    const destDir = path.resolve('../generated/server')
    const destFilePath = path.join(destDir, 'express-routes.generated.ts')
    const copiedSourcePath = path.join(destDir, path.basename(sourceFilePath))
    const runnerFilePath = path.join(destDir, 'run-generated.ts')
    const packageJsonPath = path.join(destDir, 'package.json')
    const tsConfigPath = path.join(destDir, 'tsconfig.json')

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
    }

    const methodNames = routeStubs.map((stub) => stub.methodName)
    const importsLine = methodNames.length > 0
        ? `import { ${methodNames.join(', ')} } from './index-server'`
        : ''

    const routesCode = routeStubs.map((stub) => stub.routeBody).join('\n\n')

    const fileContent = routesFileTemplate
        .replaceAll('{{importsLine}}', importsLine)
        .replaceAll('{{routesCode}}', routesCode)

    fs.writeFileSync(destFilePath, fileContent, 'utf8')
    fs.copyFileSync(sourceFilePath, copiedSourcePath)
    fs.writeFileSync(runnerFilePath, generatedRunnerTemplate, 'utf8')
    fs.writeFileSync(packageJsonPath, generatedPackageTemplate, 'utf8')
    fs.writeFileSync(tsConfigPath, generatedTsConfigTemplate, 'utf8')

    return {
        routesFile: destFilePath,
        copiedSourceFile: copiedSourcePath,
        runnerFile: runnerFilePath,
        packageJsonFile: packageJsonPath,
        tsConfigFile: tsConfigPath
    }
}

createExpressRoutesFile()

console.log(JSON.stringify(routeStubs, null, 2))
