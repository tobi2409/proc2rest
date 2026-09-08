import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import * as path from 'path'
import {
    getAppRootPath,
    getGeneratedServerRootPath,
    getGeneratedClientRootPath,
    getConfigPath,
    getSrcServerRootPath,
    getSrcClientRootPath
} from '../../../scripts/generators/shared/cli-args.js'

const originalArgv = process.argv

afterEach(() => {
    process.argv = originalArgv
})

test('getAppRootPath resolves to cwd when no --appPath flag is given', () => {
    process.argv = ['node', 'script.js']
    assert.equal(getAppRootPath(), path.resolve('./'))
})

test('getAppRootPath reads the value after a --appPath flag', () => {
    process.argv = ['node', 'script.js', '--appPath', '/tmp/my-app']
    assert.equal(getAppRootPath(), path.resolve('/tmp/my-app'))
})

test('getAppRootPath reads --appPath=value syntax', () => {
    process.argv = ['node', 'script.js', '--appPath=/tmp/other-app']
    assert.equal(getAppRootPath(), path.resolve('/tmp/other-app'))
})

test('getGeneratedServerRootPath falls back to generated/server under the app root', () => {
    assert.equal(
        getGeneratedServerRootPath('/tmp/app'),
        path.resolve('/tmp/app', 'generated/server')
    )
})

test('getGeneratedServerRootPath honors a relative --generatedServerDir override', () => {
    process.argv = ['node', 'script.js', '--generatedServerDir', 'out/server']
    assert.equal(
        getGeneratedServerRootPath('/tmp/app'),
        path.resolve('/tmp/app', 'out/server')
    )
})

test('getGeneratedServerRootPath honors an absolute --generatedServerDir override', () => {
    process.argv = ['node', 'script.js', '--generatedServerDir', '/abs/server']
    assert.equal(getGeneratedServerRootPath('/tmp/app'), path.resolve('/abs/server'))
})

test('getGeneratedClientRootPath falls back to generated/client under the app root', () => {
    assert.equal(
        getGeneratedClientRootPath('/tmp/app'),
        path.resolve('/tmp/app', 'generated/client')
    )
})

test('getConfigPath falls back to proc2rest.config.json under the app root', () => {
    assert.equal(
        getConfigPath('/tmp/app'),
        path.join('/tmp/app', 'proc2rest.config.json')
    )
})

test('getConfigPath honors a --configPath override', () => {
    process.argv = ['node', 'script.js', '--configPath', 'config/custom.json']
    assert.equal(
        getConfigPath('/tmp/app'),
        path.resolve('/tmp/app', 'config/custom.json')
    )
})

test('getSrcServerRootPath falls back to src/server under the app root', () => {
    assert.equal(getSrcServerRootPath('/tmp/app'), path.resolve('/tmp/app', 'src/server'))
})

test('getSrcClientRootPath falls back to src/client under the app root', () => {
    assert.equal(getSrcClientRootPath('/tmp/app'), path.resolve('/tmp/app', 'src/client'))
})
