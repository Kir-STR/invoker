import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRegistry, loadRegistry } from '../lib/registry.mjs'
import { resolveDependencies } from '../lib/resolve.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const valid = {
  'a': { title: 'A', group: 'g', default: true, files: ['rules/a.md'], depends_on: [] },
  'b': { title: 'B', group: 'g', default: false, files: ['rules/b.md'], depends_on: ['a'] },
}

test('validateRegistry returns registry when valid', () => {
  assert.equal(validateRegistry(valid), valid)
})

test('validateRegistry throws on missing title', () => {
  const bad = { 'a': { files: [], depends_on: [] } }
  assert.throws(() => validateRegistry(bad), /missing title/)
})

test('validateRegistry throws when files is not an array', () => {
  const bad = { 'a': { title: 'A', files: 'rules/a.md', depends_on: [] } }
  assert.throws(() => validateRegistry(bad), /files must be an array/)
})

test('validateRegistry throws on depends_on referencing unknown module', () => {
  const bad = { 'a': { title: 'A', files: [], depends_on: ['ghost'] } }
  assert.throws(() => validateRegistry(bad), /unknown module 'ghost'/)
})

test('real modules.json is valid and every module resolves without cycles', () => {
  const reg = validateRegistry(loadRegistry(join(ROOT, 'modules.json')))
  for (const id of Object.keys(reg)) {
    assert.doesNotThrow(() => resolveDependencies(reg, [id]))
  }
})

test('review-loop cascades to pr-policy and worktree-workflow', () => {
  const reg = loadRegistry(join(ROOT, 'modules.json'))
  assert.deepEqual(
    resolveDependencies(reg, ['review-loop']),
    ['worktree-workflow', 'pr-policy', 'review-loop'],
  )
})
