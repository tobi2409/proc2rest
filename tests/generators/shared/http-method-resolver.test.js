import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveHttpMethod } from '../../../scripts/generators/shared/http-method-resolver.js'

test('matches default rules for common verb prefixes', () => {
    assert.equal(resolveHttpMethod('getPerson'), 'GET')
    assert.equal(resolveHttpMethod('listPeople'), 'GET')
    assert.equal(resolveHttpMethod('createPerson'), 'POST')
    assert.equal(resolveHttpMethod('updatePerson'), 'PATCH')
    assert.equal(resolveHttpMethod('deletePerson'), 'DELETE')
})

test('falls back to POST when no rule matches', () => {
    assert.equal(resolveHttpMethod('doSomethingCustom'), 'POST')
})

test('a custom function override wins over the method rules', () => {
    assert.equal(
        resolveHttpMethod('getBinDataInfo', undefined, { getBinDataInfo: 'POST' }),
        'POST'
    )
})

test('uses custom method rules when provided', () => {
    assert.equal(resolveHttpMethod('fetchThing', { GET: '^fetch' }), 'GET')
})

test('ignores non-string rule patterns and falls back to POST', () => {
    assert.equal(resolveHttpMethod('getThing', { GET: 123 }), 'POST')
})
