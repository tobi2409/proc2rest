import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { copyDirectoryRecursive, copySourceTree } from '../../../scripts/generators/shared/file-copy.js'

function makeTempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('copyDirectoryRecursive copies nested files and directories', () => {
    const src = makeTempDir('proc2rest-copy-src-')
    const dest = makeTempDir('proc2rest-copy-dest-')
    try {
        fs.mkdirSync(path.join(src, 'nested'))
        fs.writeFileSync(path.join(src, 'a.txt'), 'a')
        fs.writeFileSync(path.join(src, 'nested/b.txt'), 'b')

        copyDirectoryRecursive(src, dest)

        assert.equal(fs.readFileSync(path.join(dest, 'a.txt'), 'utf8'), 'a')
        assert.equal(fs.readFileSync(path.join(dest, 'nested/b.txt'), 'utf8'), 'b')
    } finally {
        fs.rmSync(src, { recursive: true, force: true })
        fs.rmSync(dest, { recursive: true, force: true })
    }
})

test('copyDirectoryRecursive removes stale destination entries not present in source', () => {
    const src = makeTempDir('proc2rest-copy-src-')
    const dest = makeTempDir('proc2rest-copy-dest-')
    try {
        fs.writeFileSync(path.join(dest, 'stale.txt'), 'old')
        fs.writeFileSync(path.join(src, 'fresh.txt'), 'new')

        copyDirectoryRecursive(src, dest)

        assert.equal(fs.existsSync(path.join(dest, 'stale.txt')), false)
        assert.equal(fs.readFileSync(path.join(dest, 'fresh.txt'), 'utf8'), 'new')
    } finally {
        fs.rmSync(src, { recursive: true, force: true })
        fs.rmSync(dest, { recursive: true, force: true })
    }
})

test('copyDirectoryRecursive preserves configured entries in the destination', () => {
    const src = makeTempDir('proc2rest-copy-src-')
    const dest = makeTempDir('proc2rest-copy-dest-')
    try {
        fs.mkdirSync(path.join(dest, 'node_modules'))
        fs.writeFileSync(path.join(dest, 'node_modules/keep.txt'), 'keep')
        fs.writeFileSync(path.join(src, 'fresh.txt'), 'new')

        copyDirectoryRecursive(src, dest, { preserveEntries: ['node_modules'] })

        assert.equal(
            fs.readFileSync(path.join(dest, 'node_modules/keep.txt'), 'utf8'),
            'keep'
        )
        assert.equal(fs.readFileSync(path.join(dest, 'fresh.txt'), 'utf8'), 'new')
    } finally {
        fs.rmSync(src, { recursive: true, force: true })
        fs.rmSync(dest, { recursive: true, force: true })
    }
})

test('copySourceTree throws when the source directory does not exist', () => {
    const dest = makeTempDir('proc2rest-copy-dest-')
    try {
        assert.throws(
            () => copySourceTree('/does/not/exist', dest),
            /Source directory not found/
        )
    } finally {
        fs.rmSync(dest, { recursive: true, force: true })
    }
})

test('copySourceTree copies the tree while preserving node_modules', () => {
    const src = makeTempDir('proc2rest-copy-src-')
    const dest = makeTempDir('proc2rest-copy-dest-')
    try {
        fs.writeFileSync(path.join(src, 'index.ts'), 'export {}')
        fs.mkdirSync(path.join(dest, 'node_modules'))
        fs.writeFileSync(path.join(dest, 'node_modules/pkg.js'), 'module.exports = {}')

        copySourceTree(src, dest)

        assert.equal(fs.readFileSync(path.join(dest, 'index.ts'), 'utf8'), 'export {}')
        assert.equal(fs.existsSync(path.join(dest, 'node_modules/pkg.js')), true)
    } finally {
        fs.rmSync(src, { recursive: true, force: true })
        fs.rmSync(dest, { recursive: true, force: true })
    }
})
