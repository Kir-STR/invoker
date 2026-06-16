import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry, validateRegistry } from '../lib/registry.mjs'
import { resolveDependencies } from '../lib/resolve.mjs'
import { copyRules, renderInstruction, buildSnapshot, writeFileEnsured } from '../lib/scaffold.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIX = join(HERE, 'fixtures')

test('end-to-end scaffold on fixtures: pr pulls ww, blocks filtered, exact copy', () => {
  const target = mkdtempSync(join(tmpdir(), 'ivk-int-'))
  try {
    const registry = validateRegistry(loadRegistry(join(FIX, 'modules.json')))
    const resolved = resolveDependencies(registry, ['pr']) // должно дотянуть ww
    assert.deepEqual(resolved, ['ww', 'pr'])

    copyRules(registry, resolved, join(FIX, 'templates'), join(target, '.claude', 'rules'))
    assert.ok(existsSync(join(target, '.claude', 'rules', 'ww.md')))
    assert.ok(existsSync(join(target, '.claude', 'rules', 'pr.md')))
    assert.ok(!existsSync(join(target, '.claude', 'rules', 'og.md'))) // og не выбран

    const tmpl = readFileSync(join(FIX, 'templates', 'instructions', 'CLAUDE.md.tmpl'), 'utf8')
    const rendered = renderInstruction(tmpl, resolved)
    assert.match(rendered, /See worktree workflow\./)
    assert.match(rendered, /See PR policy\./)
    assert.doesNotMatch(rendered, /See operator gate\./) // og-блок вырезан
    assert.doesNotMatch(rendered, /<!-- module:/) // маркеры сняты

    const snap = buildSnapshot({
      pluginVersion: '0.1.0', engines: ['claude'],
      selected: ['pr'], resolved, now: '2026-06-16T00:00:00.000Z',
    })
    writeFileEnsured(join(target, '.invoker', 'modules.json'), JSON.stringify(snap, null, 2))
    const written = JSON.parse(readFileSync(join(target, '.invoker', 'modules.json'), 'utf8'))
    assert.deepEqual(written.resolved_modules, ['ww', 'pr'])
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})
