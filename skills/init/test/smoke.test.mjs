import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const HELPER = join(ROOT, 'skills', 'init', 'helper.mjs')

test('resolve prints cascade for review-loop', () => {
  const out = execFileSync('node', [HELPER, 'resolve', '--modules', 'review-loop'], { encoding: 'utf8' })
  const plan = JSON.parse(out)
  assert.deepEqual(plan.resolved, ['worktree-workflow', 'pr-policy', 'review-loop'])
  assert.deepEqual(plan.added, ['worktree-workflow', 'pr-policy'])
})

test('apply scaffolds recommended profile into a temp project', () => {
  const target = mkdtempSync(join(tmpdir(), 'ivk-smoke-'))
  try {
    execFileSync('node', [
      HELPER, 'apply',
      '--target', target,
      '--engines', 'claude,agents',
      '--modules', 'operator-gate,retro-loop',
    ], { encoding: 'utf8' })

    assert.ok(existsSync(join(target, 'CLAUDE.md')))
    assert.ok(existsSync(join(target, 'AGENTS.md')))
    assert.ok(existsSync(join(target, '.claude', 'rules', 'operator-gate.md')))
    assert.ok(existsSync(join(target, '.claude', 'rules', 'retro-loop.md')))
    assert.ok(existsSync(join(target, 'ideas_4_rules.md')))
    assert.ok(existsSync(join(target, '.claude', 'retro-template.md'))) // retro-loop выбран
    assert.ok(existsSync(join(target, '.invoker', 'modules.json')))

    // Инструкц-файл: блоки невыбранных модулей вырезаны, маркеры сняты
    const claude = readFileSync(join(target, 'CLAUDE.md'), 'utf8')
    assert.doesNotMatch(claude, /<!-- module:/)
    assert.match(claude, /Operator gate/)
    assert.doesNotMatch(claude, /Worktree workflow/) // не выбран

    // Слепок корректен
    const snap = JSON.parse(readFileSync(join(target, '.invoker', 'modules.json'), 'utf8'))
    assert.equal(snap.plugin, 'invoker')
    assert.deepEqual(snap.selected_modules, ['operator-gate', 'retro-loop'])
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})
