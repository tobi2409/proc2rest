import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as path from 'path'
import { getRelativePathFromSrcDir } from '../../../scripts/generators/shared/path-utils.js'

test('returns path relative to the src directory when nested inside it', () => {
    const srcDir = path.resolve('/project/src/server')
    const fullPath = path.resolve('/project/src/server/first/my-server.ts')

    assert.equal(
        getRelativePathFromSrcDir(fullPath, srcDir),
        path.join('first', 'my-server.ts')
    )
})

test('returns the normalized full path when it is outside the src directory', () => {
    const srcDir = path.resolve('/project/src/server')
    const fullPath = path.resolve('/other/place/file.ts')

    assert.equal(
        getRelativePathFromSrcDir(fullPath, srcDir),
        path.normalize(fullPath)
    )
})

test('does not treat a similarly prefixed directory as a child directory', () => {
    const srcDir = path.resolve('/project/src/server')
    const fullPath = path.resolve('/project/src/server2/file.ts')

    assert.equal(
        getRelativePathFromSrcDir(fullPath, srcDir),
        path.normalize(fullPath)
    )
})

test('returns an empty string when the full path equals the src directory', () => {
    const srcDir = path.resolve('/project/src/server')

    assert.equal(getRelativePathFromSrcDir(srcDir, srcDir), '')
})
