import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDependencies } from '../lib/resolve.mjs'

const reg = {
  'operator-gate': { title: 'OG', files: [], depends_on: [] },
  'worktree-workflow': { title: 'WW', files: [], depends_on: [] },
  'pr-policy': { title: 'PR', files: [], depends_on: ['worktree-workflow'] },
  'review-loop': { title: 'RL', files: [], depends_on: ['pr-policy'] },
}

test('resolves a module without deps to itself', () => {
  assert.deepEqual(resolveDependencies(reg, ['operator-gate']), ['operator-gate'])
})

test('cascades transitive deps before the dependent (topological order)', () => {
  assert.deepEqual(
    resolveDependencies(reg, ['review-loop']),
    ['worktree-workflow', 'pr-policy', 'review-loop'],
  )
})

test('does not duplicate a module already pulled by cascade', () => {
  const out = resolveDependencies(reg, ['pr-policy', 'review-loop'])
  assert.deepEqual(out, ['worktree-workflow', 'pr-policy', 'review-loop'])
})

test('throws on unknown selected module', () => {
  assert.throws(() => resolveDependencies(reg, ['ghost']), /Unknown module: ghost/)
})

test('throws on dependency cycle with the chain in the message', () => {
  const cyclic = {
    'x': { title: 'X', files: [], depends_on: ['y'] },
    'y': { title: 'Y', files: [], depends_on: ['x'] },
  }
  assert.throws(() => resolveDependencies(cyclic, ['x']), /cycle: x → y → x/)
})
