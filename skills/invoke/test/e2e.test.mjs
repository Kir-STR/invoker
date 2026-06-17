import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// e2e: гоняем РЕАЛЬНЫЙ helper.mjs apply на РЕАЛЬНОМ реестре (не фикстуры) —
// весь набор модулей, все три движка — и проверяем полный вывод в целевом проекте.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const HELPER = join(ROOT, 'skills', 'invoke', 'helper.mjs')

const ALL_MODULES = [
  'operator-gate', 'retro-loop', 'secret-hygiene',
  'worktree-workflow', 'pr-policy', 'review-loop',
  'subagent-dispatch',
  'safety', 'architectural-invariants', 'versioning', 'glossary',
]

test('e2e: apply all modules + all engines into a real target project', () => {
  const target = mkdtempSync(join(tmpdir(), 'ivk-e2e-'))
  try {
    const out = execFileSync('node', [
      HELPER, 'apply',
      '--target', target,
      '--engines', 'claude,agents,gemini',
      '--modules', ALL_MODULES.join(','),
    ], { encoding: 'utf8' })
    const report = JSON.parse(out)

    // Все три инструкц-файла созданы
    for (const f of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) {
      assert.ok(existsSync(join(target, f)), `missing ${f}`)
    }

    // Каждый модуль скопирован в .claude/rules/, включая два новых
    for (const id of ALL_MODULES) {
      assert.ok(
        existsSync(join(target, '.claude', 'rules', `${id}.md`)),
        `missing rule ${id}.md`,
      )
    }

    // Новые модули присутствуют и в рендере, и маркеры всюду сняты
    for (const f of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) {
      const text = readFileSync(join(target, f), 'utf8')
      assert.doesNotMatch(text, /<!-- module:/, `${f}: markers must be stripped`)
      assert.match(text, /secret-hygiene\.md/, `${f}: secret-hygiene missing`)
      assert.match(text, /architectural-invariants\.md/, `${f}: architectural-invariants missing`)
    }

    // Дословность копии: файл правила в проекте == шаблон байт-в-байт
    for (const id of ['secret-hygiene', 'architectural-invariants']) {
      const src = readFileSync(join(ROOT, 'templates', 'rules', `${id}.md`))
      const dst = readFileSync(join(target, '.claude', 'rules', `${id}.md`))
      assert.ok(src.equals(dst), `${id}.md must be a verbatim copy`)
    }

    // Служебная зона .invoker/
    assert.ok(existsSync(join(target, '.invoker', 'ideas_4_rules.md')))
    assert.ok(existsSync(join(target, '.invoker', 'retro-template.md'))) // retro-loop выбран
    assert.ok(!existsSync(join(target, 'ideas_4_rules.md'))) // не в корне

    // Слепок: реальный реестр, два новых в selected, каскад в resolved
    const snap = JSON.parse(readFileSync(join(target, '.invoker', 'modules.json'), 'utf8'))
    assert.equal(snap.plugin, 'invoker')
    assert.ok(snap.plugin_version, 'snapshot must carry plugin_version')
    assert.deepEqual(snap.engines, ['claude', 'agents', 'gemini'])
    for (const id of ['secret-hygiene', 'architectural-invariants']) {
      assert.ok(snap.selected_modules.includes(id), `snapshot selected must include ${id}`)
      assert.ok(snap.resolved_modules.includes(id), `snapshot resolved must include ${id}`)
    }
    // helper форсит claude первым движком даже если не указан явно (здесь указан) — порядок сохранён
    assert.equal(report.resolved.length, snap.resolved_modules.length)
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})
