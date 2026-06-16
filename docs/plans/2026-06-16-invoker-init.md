# invoker — субстрат + `init` Implementation Plan

> **For agentic workers:** исполняй задачу-за-задачей своим воркфлоу исполнения планов (или эквивалентом), с ревью между задачами. Steps use checkbox (`- [ ]`) syntax for tracking.

**Scope (важно):** это **План A** — обязательный субстрат + скилл `init`. Полный MVP спеки §2 включает также скилл `retro`; он **намеренно вне этого плана** и покрывается отдельным **Планом B**. «Spec coverage» в self-review ниже относится к части §2, касающейся субстрата и init, а не ко всему MVP.

**Goal:** Реализовать Claude Code plugin `invoker` в части обязательного субстрата и скилла `ivk init` — детерминированный скаффолдер, раскладывающий выбранные модули в целевой проект.

**Architecture:** Гибрид. Тонкий `skills/init/SKILL.md` оркеструет (capability-вопросы, gated-подтверждения, отчёт) и вызывает Node-ядро. Вся детерминированная механика (валидация реестра, резолв `depends_on`, вырезание блоков `<!-- module:<id> -->`, дословное копирование, запись слепка) живёт в чистых функциях под `skills/init/lib/`, покрытых `node:test`. CLI `skills/init/helper.mjs` — тонкая обёртка над библиотекой. Реальный контент правил (фаза 2) дистиллируется из проекта eve и развязан с ядром через fixture-шаблоны в тестах.

**Tech Stack:** Node.js (ESM `.mjs`), встроенный тест-раннер `node:test` + `node:assert/strict`. Без внешних зависимостей. Контент — Markdown + JSON.

**Источник правды:** `docs/specs/2026-06-15-invoker-design.md`. eve-репо для дистилляции контента: `C:\Users\T590\!work\1.Projects\client\eve`.

---

## File Structure

Корень git-репо `invoker/` **является** корнем плагина.

```
.claude-plugin/plugin.json     # манифест плагина (name, version, description)
package.json                   # type:module, scripts.test — для node:test
modules.json                   # РЕЕСТР модулей (control plane init; в проект НЕ копируется)
skills/
  init/
    SKILL.md                   # тонкий оркестратор (фаза 3)
    helper.mjs                 # CLI: подкоманды `resolve` и `apply`
    lib/
      registry.mjs             # loadRegistry, validateRegistry
      resolve.mjs              # resolveDependencies (каскад + детект циклов/битых ссылок)
      blocks.mjs               # filterModuleBlocks (вырезание <!-- module:<id> --> блоков)
      scaffold.mjs             # copyRules, renderInstruction, buildSnapshot, ENGINE_FILES
    test/
      registry.test.mjs
      resolve.test.mjs
      blocks.test.mjs
      scaffold.test.mjs
      integration.test.mjs
      consistency.test.mjs     # инвариант реестр ↔ files ↔ templates (Task 11b)
      smoke.test.mjs           # сквозной прогон CLI на реальном контенте (Task 12)
      fixtures/                # мини-templates + мини-реестр для интеграционного теста
templates/
  instructions/
    CLAUDE.md.tmpl
    AGENTS.md.tmpl
    GEMINI.md.tmpl
  rules/                       # по файлу на модуль (9 шт.)
    operator-gate.md  retro-loop.md  worktree-workflow.md  pr-policy.md
    review-loop.md  subagent-dispatch.md  safety.md  versioning.md  glossary.md
  seed/
    ideas_4_rules.md           # пустой inbox
    retro-template.md
README.md
```

**Целевой проект** (что `init` создаёт) получает: `CLAUDE.md` (+ выбранные `AGENTS.md`/`GEMINI.md`), `.claude/rules/<выбранные>.md`, `.claude/rules/` каркас, `ideas_4_rules.md`, `.invoker/modules.json` (слепок), `retro-template.md` если выбран `retro-loop`. Реестр `modules.json` в проект **не** копируется.

---

## Phase 0 — Каркас плагина

### Task 1: Манифест плагина и package.json

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `package.json`

- [ ] **Step 1: Создать манифест плагина**

`.claude-plugin/plugin.json`:

```json
{
  "name": "invoker",
  "version": "0.1.0",
  "description": "Дисциплинарный слой и движок эволюции правил для AI-агентов в любом проекте."
}
```

- [ ] **Step 2: Создать package.json**

`package.json` (ESM-режим + удобный запуск тестов; внешних зависимостей нет):

```json
{
  "name": "invoker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"skills/init/test/*.test.mjs\""
  }
}
```

> Примечание: на Windows + Node 21+ `node --test <каталог>/` ошибочно грузит каталог как модуль. Передаём quoted-glob `"…/*.test.mjs"` — Node раскрывает его сам, кросс-платформенно, и подхватывает только тест-файлы (не fixtures).

- [ ] **Step 3: Проверить среду и валидность манифестов**

Run: `node --version && node -e "JSON.parse(require('node:fs').readFileSync('.claude-plugin/plugin.json','utf8'));JSON.parse(require('node:fs').readFileSync('package.json','utf8'));console.log('manifests ok')"`
Expected: печатает версию Node и `manifests ok`. (Тест-раннер `npm test` гоняется начиная с Task 2, когда появится первый тест — на несуществующем `test/` node завершился бы ошибкой.)

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json package.json
git commit -m "chore: scaffold invoker plugin manifest and package.json"
```

---

## Phase 1 — Node-ядро (строгий TDD)

Все функции — чистые, тестируются изолированно. Файловые операции инжектируют пути; время инжектируется параметром (для детерминизма теста слепка).

### Task 2: Реестр — загрузка и валидация

**Files:**
- Create: `skills/init/lib/registry.mjs`
- Test: `skills/init/test/registry.test.mjs`

- [ ] **Step 1: Написать падающие тесты**

`skills/init/test/registry.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateRegistry } from '../lib/registry.mjs'

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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node --test skills/init/test/registry.test.mjs`
Expected: FAIL — `Cannot find module '../lib/registry.mjs'`.

- [ ] **Step 3: Реализовать registry.mjs**

`skills/init/lib/registry.mjs`:

```js
import { readFileSync } from 'node:fs'

// modules.json — строгий JSON (без комментариев): JSON.parse должен его прочитать.
export function loadRegistry(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function validateRegistry(registry) {
  const ids = Object.keys(registry)
  const errors = []
  for (const [id, mod] of Object.entries(registry)) {
    if (!mod || typeof mod.title !== 'string' || mod.title.length === 0) {
      errors.push(`module ${id}: missing title`)
    }
    if (!Array.isArray(mod?.files)) {
      errors.push(`module ${id}: files must be an array`)
    }
    if (!Array.isArray(mod?.depends_on)) {
      errors.push(`module ${id}: depends_on must be an array`)
    }
    for (const dep of mod?.depends_on ?? []) {
      if (!ids.includes(dep)) {
        errors.push(`module ${id}: depends_on references unknown module '${dep}'`)
      }
    }
  }
  if (errors.length) throw new Error('Invalid registry:\n' + errors.join('\n'))
  return registry
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `node --test skills/init/test/registry.test.mjs`
Expected: PASS — 4 теста.

- [ ] **Step 5: Commit**

```bash
git add skills/init/lib/registry.mjs skills/init/test/registry.test.mjs
git commit -m "feat(init): registry load and validation"
```

### Task 3: Резолв зависимостей (каскад, циклы, неизвестные)

**Files:**
- Create: `skills/init/lib/resolve.mjs`
- Test: `skills/init/test/resolve.test.mjs`

- [ ] **Step 1: Написать падающие тесты**

`skills/init/test/resolve.test.mjs`:

```js
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node --test skills/init/test/resolve.test.mjs`
Expected: FAIL — `Cannot find module '../lib/resolve.mjs'`.

- [ ] **Step 3: Реализовать resolve.mjs**

`skills/init/lib/resolve.mjs`:

```js
// Возвращает selected + дотянутые зависимости в топологическом порядке
// (каждая зависимость стоит раньше зависящего от неё модуля).
export function resolveDependencies(registry, selected) {
  const resolved = []
  const visiting = new Set()
  const done = new Set()

  function visit(id, chain) {
    if (done.has(id)) return
    if (visiting.has(id)) {
      throw new Error(`Dependency cycle: ${[...chain, id].join(' → ')}`)
    }
    if (!registry[id]) {
      throw new Error(`Unknown module: ${id}`)
    }
    visiting.add(id)
    for (const dep of registry[id].depends_on ?? []) {
      visit(dep, [...chain, id])
    }
    visiting.delete(id)
    done.add(id)
    resolved.push(id)
  }

  for (const id of selected) visit(id, [])
  return resolved
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `node --test skills/init/test/resolve.test.mjs`
Expected: PASS — 5 тестов.

- [ ] **Step 5: Commit**

```bash
git add skills/init/lib/resolve.mjs skills/init/test/resolve.test.mjs
git commit -m "feat(init): dependency resolution with cascade and cycle detection"
```

### Task 4: Вырезание блоков `<!-- module:<id> -->`

**Files:**
- Create: `skills/init/lib/blocks.mjs`
- Test: `skills/init/test/blocks.test.mjs`

- [ ] **Step 1: Написать падающие тесты**

`skills/init/test/blocks.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterModuleBlocks, listModuleBlockIds } from '../lib/blocks.mjs'

const tmpl = [
  'Header line.',
  '<!-- module:a -->',
  'Content A',
  '<!-- /module -->',
  '<!-- module:b -->',
  'Content B',
  '<!-- /module -->',
  'Footer line.',
].join('\n')

test('keeps content of selected modules and strips their markers', () => {
  const out = filterModuleBlocks(tmpl, ['a'])
  assert.equal(out, ['Header line.', 'Content A', 'Footer line.'].join('\n'))
})

test('removes the whole block of unselected modules', () => {
  const out = filterModuleBlocks(tmpl, [])
  assert.equal(out, ['Header line.', 'Footer line.'].join('\n'))
})

test('keeps all when all ids selected', () => {
  const out = filterModuleBlocks(tmpl, ['a', 'b'])
  assert.equal(out, ['Header line.', 'Content A', 'Content B', 'Footer line.'].join('\n'))
})

test('throws on an unclosed module block', () => {
  const broken = '<!-- module:a -->\nContent A'
  assert.throws(() => filterModuleBlocks(broken, ['a']), /unclosed module block: a/)
})

test('listModuleBlockIds returns the set of all block ids', () => {
  assert.deepEqual(listModuleBlockIds(tmpl), new Set(['a', 'b']))
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node --test skills/init/test/blocks.test.mjs`
Expected: FAIL — `Cannot find module '../lib/blocks.mjs'`.

- [ ] **Step 3: Реализовать blocks.mjs**

`skills/init/lib/blocks.mjs`:

```js
const OPEN = /^\s*<!--\s*module:([\w-]+)\s*-->\s*$/
const CLOSE = /^\s*<!--\s*\/module\s*-->\s*$/

// Оставляет содержимое блоков из keepIds (снимая маркеры),
// удаляет блоки модулей не из keepIds целиком. Маркеры в выводе не остаются.
export function filterModuleBlocks(text, keepIds) {
  const keep = new Set(keepIds)
  const out = []
  let openId = null   // id текущего открытого блока, либо null
  let skipping = false

  for (const line of text.split('\n')) {
    const open = line.match(OPEN)
    if (open) {
      if (openId !== null) {
        throw new Error(`nested module block: ${open[1]} inside ${openId}`)
      }
      openId = open[1]
      skipping = !keep.has(openId)
      continue // маркер не пишем
    }
    if (CLOSE.test(line)) {
      if (openId === null) throw new Error('stray <!-- /module --> with no open block')
      openId = null
      skipping = false
      continue // маркер не пишем
    }
    if (skipping) continue
    out.push(line)
  }

  if (openId !== null) throw new Error(`unclosed module block: ${openId}`)
  return out.join('\n')
}

// Возвращает множество id всех открывающих маркеров <!-- module:id --> в тексте.
export function listModuleBlockIds(text) {
  const ids = new Set()
  for (const line of text.split('\n')) {
    const m = line.match(OPEN)
    if (m) ids.add(m[1])
  }
  return ids
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `node --test skills/init/test/blocks.test.mjs`
Expected: PASS — 5 тестов.

- [ ] **Step 5: Commit**

```bash
git add skills/init/lib/blocks.mjs skills/init/test/blocks.test.mjs
git commit -m "feat(init): module-block filtering for instruction templates"
```

### Task 5: Скаффолдинг — копирование правил, рендер инструкций, слепок

**Files:**
- Create: `skills/init/lib/scaffold.mjs`
- Test: `skills/init/test/scaffold.test.mjs`

- [ ] **Step 1: Написать падающие тесты**

`skills/init/test/scaffold.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { copyRules, renderInstruction, buildSnapshot, ENGINE_FILES } from '../lib/scaffold.mjs'

test('ENGINE_FILES maps engines to template and output names', () => {
  assert.deepEqual(ENGINE_FILES.claude, { tmpl: 'CLAUDE.md.tmpl', out: 'CLAUDE.md' })
  assert.deepEqual(ENGINE_FILES.agents, { tmpl: 'AGENTS.md.tmpl', out: 'AGENTS.md' })
  assert.deepEqual(ENGINE_FILES.gemini, { tmpl: 'GEMINI.md.tmpl', out: 'GEMINI.md' })
})

test('renderInstruction delegates to block filtering', () => {
  const t = '<!-- module:a -->\nA\n<!-- /module -->\n<!-- module:b -->\nB\n<!-- /module -->'
  assert.equal(renderInstruction(t, ['a']), 'A')
})

test('copyRules copies module files byte-for-byte into target', () => {
  const src = mkdtempSync(join(tmpdir(), 'ivk-src-'))
  const dst = mkdtempSync(join(tmpdir(), 'ivk-dst-'))
  try {
    mkdirSync(join(src, 'rules'))
    // BOM + плейсхолдер: проверяем именно побайтовую идентичность, не текстовую.
    const bytes = Buffer.from('﻿RULE A {{PLACEHOLDER}}\n', 'utf8')
    writeFileSync(join(src, 'rules', 'a.md'), bytes)
    const reg = { 'a': { title: 'A', files: ['rules/a.md'], depends_on: [] } }

    copyRules(reg, ['a'], src, join(dst, '.claude', 'rules'))

    const copied = readFileSync(join(dst, '.claude', 'rules', 'a.md')) // Buffer, без encoding
    assert.ok(copied.equals(bytes)) // байт-в-байт, BOM и плейсхолдеры не тронуты
  } finally {
    rmSync(src, { recursive: true, force: true })
    rmSync(dst, { recursive: true, force: true })
  }
})

test('buildSnapshot produces the snapshot shape with injected time', () => {
  const snap = buildSnapshot({
    pluginVersion: '0.1.0',
    engines: ['claude', 'agents'],
    selected: ['operator-gate', 'retro-loop'],
    resolved: ['operator-gate', 'retro-loop'],
    now: '2026-06-16T00:00:00.000Z',
  })
  assert.deepEqual(snap, {
    plugin: 'invoker',
    plugin_version: '0.1.0',
    engines: ['claude', 'agents'],
    selected_modules: ['operator-gate', 'retro-loop'],
    resolved_modules: ['operator-gate', 'retro-loop'],
    created_at: '2026-06-16T00:00:00.000Z',
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node --test skills/init/test/scaffold.test.mjs`
Expected: FAIL — `Cannot find module '../lib/scaffold.mjs'`.

- [ ] **Step 3: Реализовать scaffold.mjs**

`skills/init/lib/scaffold.mjs`:

```js
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { filterModuleBlocks } from './blocks.mjs'

export const ENGINE_FILES = {
  claude: { tmpl: 'CLAUDE.md.tmpl', out: 'CLAUDE.md' },
  agents: { tmpl: 'AGENTS.md.tmpl', out: 'AGENTS.md' },
  gemini: { tmpl: 'GEMINI.md.tmpl', out: 'GEMINI.md' },
}

// Копирует файлы каждого выбранного модуля в targetRulesDir (по basename)
// побайтово — copyFileSync не декодирует/не перекодирует содержимое.
export function copyRules(registry, resolved, srcDir, targetRulesDir) {
  mkdirSync(targetRulesDir, { recursive: true })
  for (const id of resolved) {
    for (const rel of registry[id].files) {
      copyFileSync(join(srcDir, rel), join(targetRulesDir, basename(rel)))
    }
  }
}

export function renderInstruction(templateText, resolved) {
  return filterModuleBlocks(templateText, resolved)
}

export function buildSnapshot({ pluginVersion, engines, selected, resolved, now }) {
  return {
    plugin: 'invoker',
    plugin_version: pluginVersion,
    engines,
    selected_modules: selected,
    resolved_modules: resolved,
    created_at: now,
  }
}

// Утилита записи с авто-созданием родительского каталога (используется CLI).
export function writeFileEnsured(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `node --test skills/init/test/scaffold.test.mjs`
Expected: PASS — 4 теста.

- [ ] **Step 5: Commit**

```bash
git add skills/init/lib/scaffold.mjs skills/init/test/scaffold.test.mjs
git commit -m "feat(init): scaffolding — rule copy, instruction render, snapshot"
```

### Task 6: CLI `helper.mjs` — подкоманды `resolve` и `apply`

**Files:**
- Create: `skills/init/helper.mjs`

`resolve` печатает план (selected/resolved/added) JSON-ом без записи на диск — SKILL.md показывает его оператору перед подтверждением. `apply` выполняет всю раскладку.

- [ ] **Step 1: Реализовать helper.mjs**

`skills/init/helper.mjs`:

```js
#!/usr/bin/env node
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry, validateRegistry } from './lib/registry.mjs'
import { resolveDependencies } from './lib/resolve.mjs'
import {
  ENGINE_FILES, copyRules, renderInstruction, buildSnapshot, writeFileEnsured,
} from './lib/scaffold.mjs'
import { readFileSync } from 'node:fs'

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PLUGIN_VERSION = JSON.parse(
  readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
).version

function parseFlags(argv) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      flags[argv[i].slice(2)] = argv[i + 1]
      i++
    }
  }
  return flags
}

const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])

function cmdResolve(flags) {
  const registry = validateRegistry(loadRegistry(join(PLUGIN_ROOT, 'modules.json')))
  const selected = list(flags.modules)
  const resolved = resolveDependencies(registry, selected)
  const added = resolved.filter((id) => !selected.includes(id))
  process.stdout.write(JSON.stringify({ selected, resolved, added }, null, 2) + '\n')
}

function cmdApply(flags) {
  const target = flags.target
  if (!target) throw new Error('--target is required')
  const engines = list(flags.engines)
  if (!engines.includes('claude')) engines.unshift('claude') // CLAUDE.md всегда
  const registry = validateRegistry(loadRegistry(join(PLUGIN_ROOT, 'modules.json')))
  const selected = list(flags.modules)
  const resolved = resolveDependencies(registry, selected)

  const created = []

  // 1. Правила (дословная копия)
  copyRules(registry, resolved, join(PLUGIN_ROOT, 'templates'), join(target, '.claude', 'rules'))
  for (const id of resolved) for (const rel of registry[id].files) {
    created.push(`.claude/rules/${rel.split('/').pop()}`)
  }

  // 2. Инструкц-файлы под выбранные движки
  for (const engine of engines) {
    const map = ENGINE_FILES[engine]
    if (!map) throw new Error(`Unknown engine: ${engine}`)
    const tmpl = readFileSync(join(PLUGIN_ROOT, 'templates', 'instructions', map.tmpl), 'utf8')
    writeFileEnsured(join(target, map.out), renderInstruction(tmpl, resolved))
    created.push(map.out)
  }

  // 3. Seed: пустой inbox всегда; retro-template если выбран retro-loop
  writeFileEnsured(
    join(target, 'ideas_4_rules.md'),
    readFileSync(join(PLUGIN_ROOT, 'templates', 'seed', 'ideas_4_rules.md'), 'utf8'),
  )
  created.push('ideas_4_rules.md')
  if (resolved.includes('retro-loop')) {
    writeFileEnsured(
      join(target, '.claude', 'retro-template.md'),
      readFileSync(join(PLUGIN_ROOT, 'templates', 'seed', 'retro-template.md'), 'utf8'),
    )
    created.push('.claude/retro-template.md')
  }

  // 4. Слепок выбора
  const snapshot = buildSnapshot({
    pluginVersion: PLUGIN_VERSION,
    engines,
    selected,
    resolved,
    now: new Date().toISOString(),
  })
  writeFileEnsured(join(target, '.invoker', 'modules.json'), JSON.stringify(snapshot, null, 2) + '\n')
  created.push('.invoker/modules.json')

  process.stdout.write(JSON.stringify({ created, resolved }, null, 2) + '\n')
}

const [cmd, ...rest] = process.argv.slice(2)
const flags = parseFlags(rest)
try {
  if (cmd === 'resolve') cmdResolve(flags)
  else if (cmd === 'apply') cmdApply(flags)
  else throw new Error(`Unknown command: ${cmd ?? '(none)'}. Use 'resolve' or 'apply'.`)
} catch (err) {
  process.stderr.write(`invoker init: ${err.message}\n`)
  process.exit(1)
}
```

- [ ] **Step 2: Дымовая проверка `resolve` (ядро ещё без реального реестра — ожидаем понятную ошибку)**

Run: `node skills/init/helper.mjs resolve --modules operator-gate`
Expected: пока `modules.json` не существует (Task 8) — stderr `invoker init: ENOENT ... modules.json`, exit 1. Это корректное поведение, не баг. Полная проверка — в Task 12.

- [ ] **Step 3: Commit**

```bash
git add skills/init/helper.mjs
git commit -m "feat(init): CLI helper with resolve and apply subcommands"
```

### Task 7: Интеграционный тест на temp-dir (механика на fixtures)

Проверяет связку lib-функций на минимальных fixture-шаблонах — **независимо** от реального контента (Phase 2). Тест вызывает функции библиотеки напрямую (не CLI), собирая раскладку в temp-каталоге.

**Files:**
- Create: `skills/init/test/fixtures/modules.json`
- Create: `skills/init/test/fixtures/templates/instructions/CLAUDE.md.tmpl`
- Create: `skills/init/test/fixtures/templates/rules/og.md`
- Create: `skills/init/test/fixtures/templates/rules/ww.md`
- Create: `skills/init/test/fixtures/templates/rules/pr.md`
- Create: `skills/init/test/integration.test.mjs`

- [ ] **Step 1: Создать fixture-реестр**

`skills/init/test/fixtures/modules.json`:

```json
{
  "og": { "title": "OG", "group": "base", "default": true, "files": ["rules/og.md"], "depends_on": [] },
  "ww": { "title": "WW", "group": "git", "default": false, "files": ["rules/ww.md"], "depends_on": [] },
  "pr": { "title": "PR", "group": "git", "default": false, "files": ["rules/pr.md"], "depends_on": ["ww"] }
}
```

- [ ] **Step 2: Создать fixture-шаблоны**

`skills/init/test/fixtures/templates/rules/og.md`:

```markdown
# OG rule {{PLACEHOLDER}}
```

`skills/init/test/fixtures/templates/rules/ww.md`:

```markdown
# WW rule
```

`skills/init/test/fixtures/templates/rules/pr.md`:

```markdown
# PR rule
```

`skills/init/test/fixtures/templates/instructions/CLAUDE.md.tmpl`:

```markdown
# Project instructions
<!-- module:og -->
See operator gate.
<!-- /module -->
<!-- module:ww -->
See worktree workflow.
<!-- /module -->
<!-- module:pr -->
See PR policy.
<!-- /module -->
End.
```

- [ ] **Step 3: Написать интеграционный тест**

`skills/init/test/integration.test.mjs`:

```js
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
```

- [ ] **Step 4: Запустить весь набор тестов**

Run: `npm test`
Expected: PASS — все файлы (`registry`, `resolve`, `blocks`, `scaffold`, `integration`).

- [ ] **Step 5: Commit**

```bash
git add skills/init/test/fixtures skills/init/test/integration.test.mjs
git commit -m "test(init): end-to-end scaffold integration on fixtures"
```

---

## Phase 2 — Контент-авторинг (дистилляция из eve)

Ядро готово и протестировано. Теперь — реальный субстрат. Дисциплинарный текст переносится из eve **дословно**, проектная специфика заменяется на `{{PLACEHOLDERS}}` или нейтральные формулировки (спека §8). Источник: `C:\Users\T590\!work\1.Projects\client\eve\.claude\rules\`.

### Task 8: Реальный `modules.json` (9 модулей)

**Files:**
- Create: `modules.json`

- [ ] **Step 1: Создать реестр**

`modules.json` (строгий JSON — без комментариев):

```json
{
  "operator-gate": {
    "title": "Operator gate",
    "group": "base-discipline",
    "default": true,
    "files": ["rules/operator-gate.md"],
    "depends_on": [],
    "note": "Подтверждение деструктивных/наружу-направленных действий."
  },
  "retro-loop": {
    "title": "Retro loop",
    "group": "base-discipline",
    "default": true,
    "files": ["rules/retro-loop.md"],
    "depends_on": [],
    "note": "Движок эволюции правил (identity feature)."
  },
  "worktree-workflow": {
    "title": "Worktree workflow",
    "group": "git-pr-workflow",
    "default": false,
    "files": ["rules/worktree-workflow.md"],
    "depends_on": [],
    "note": "Изоляция работы в git worktrees."
  },
  "pr-policy": {
    "title": "PR policy",
    "group": "git-pr-workflow",
    "default": false,
    "files": ["rules/pr-policy.md"],
    "depends_on": ["worktree-workflow"],
    "note": "Политика веток и pull request'ов."
  },
  "review-loop": {
    "title": "Review loop",
    "group": "git-pr-workflow",
    "default": false,
    "files": ["rules/review-loop.md"],
    "depends_on": ["pr-policy"],
    "note": "Нужен CI review-бот."
  },
  "subagent-dispatch": {
    "title": "Subagent dispatch",
    "group": "subagent-workflow",
    "default": false,
    "files": ["rules/subagent-dispatch.md"],
    "depends_on": [],
    "note": "Subagent-driven стиль разработки."
  },
  "safety": {
    "title": "Safety",
    "group": "project-governance",
    "default": false,
    "files": ["rules/safety.md"],
    "depends_on": [],
    "note": "Скелет для safety-критичных проектов (kill-switch / PII / consent)."
  },
  "versioning": {
    "title": "Versioning",
    "group": "project-governance",
    "default": false,
    "files": ["rules/versioning.md"],
    "depends_on": [],
    "note": "Версионирование промптов и контрактов."
  },
  "glossary": {
    "title": "Glossary",
    "group": "project-governance",
    "default": false,
    "files": ["rules/glossary.md"],
    "depends_on": [],
    "note": "Канон терминов проекта."
  }
}
```

- [ ] **Step 2: Написать тест валидации реального реестра**

Добавить в `skills/init/test/registry.test.mjs`:

```js
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry } from '../lib/registry.mjs'
import { resolveDependencies } from '../lib/resolve.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

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
```

- [ ] **Step 3: Запустить — убедиться, что проходит**

Run: `node --test skills/init/test/registry.test.mjs`
Expected: PASS — включая 2 новых теста на реальный реестр.

- [ ] **Step 4: Commit**

```bash
git add modules.json skills/init/test/registry.test.mjs
git commit -m "feat: real module registry (9 modules)"
```

### Task 9: Инструкц-шаблоны под три движка

Три **ролевых** шаблона (спека §7): CLAUDE = оператор, AGENTS = консультант, GEMINI = ревьюер. Каждый содержит общий include-блок «факты проекта» (плейсхолдеры) + размеченные блоки `<!-- module:<id> -->` для всех 9 модулей. Текст блока — указатель на правило (`см. .claude/rules/<id>.md`), не дубль правила.

**Files:**
- Create: `templates/instructions/CLAUDE.md.tmpl`
- Create: `templates/instructions/AGENTS.md.tmpl`
- Create: `templates/instructions/GEMINI.md.tmpl`

- [ ] **Step 1: Создать `CLAUDE.md.tmpl`**

```markdown
# {{PROJECT_NAME}} — инструкции (оператор)

> Стек: {{STACK}}. Конвенции: {{CONVENTIONS}}.

## Дисциплина

Правила проекта живут в `.claude/rules/*.md` (с frontmatter `globs`/`class`). Ниже — карта активных модулей.

<!-- module:operator-gate -->
- **Operator gate** — подтверждай деструктивные/наружу-направленные действия. См. `.claude/rules/operator-gate.md`.
<!-- /module -->
<!-- module:retro-loop -->
- **Retro loop** — цикл эволюции правил. См. `.claude/rules/retro-loop.md`.
<!-- /module -->
<!-- module:worktree-workflow -->
- **Worktree workflow** — изоляция работы в git worktrees. См. `.claude/rules/worktree-workflow.md`.
<!-- /module -->
<!-- module:pr-policy -->
- **PR policy** — политика веток/PR. См. `.claude/rules/pr-policy.md`.
<!-- /module -->
<!-- module:review-loop -->
- **Review loop** — цикл ревью. См. `.claude/rules/review-loop.md`.
<!-- /module -->
<!-- module:subagent-dispatch -->
- **Subagent dispatch** — диспетчеризация субагентов. См. `.claude/rules/subagent-dispatch.md`.
<!-- /module -->
<!-- module:safety -->
- **Safety** — safety-инварианты проекта. См. `.claude/rules/safety.md`.
<!-- /module -->
<!-- module:versioning -->
- **Versioning** — версионирование промптов/контрактов. См. `.claude/rules/versioning.md`.
<!-- /module -->
<!-- module:glossary -->
- **Glossary** — канон терминов. См. `.claude/rules/glossary.md`.
<!-- /module -->
```

- [ ] **Step 2: Создать `AGENTS.md.tmpl`**

Та же структура и тот же набор `<!-- module:<id> -->` блоков, но шапка роли — консультант:

```markdown
# {{PROJECT_NAME}} — инструкции (консультант / советник)

> Канон — `CLAUDE.md`. Этот файл задаёт роль советника: сверка артефактов до публикации, возражение с доказательством.
> Стек: {{STACK}}. Конвенции: {{CONVENTIONS}}.

## Активные модули

<!-- module:operator-gate -->
- **Operator gate** — см. `.claude/rules/operator-gate.md`.
<!-- /module -->
<!-- module:retro-loop -->
- **Retro loop** — см. `.claude/rules/retro-loop.md`.
<!-- /module -->
<!-- module:worktree-workflow -->
- **Worktree workflow** — см. `.claude/rules/worktree-workflow.md`.
<!-- /module -->
<!-- module:pr-policy -->
- **PR policy** — см. `.claude/rules/pr-policy.md`.
<!-- /module -->
<!-- module:review-loop -->
- **Review loop** — см. `.claude/rules/review-loop.md`.
<!-- /module -->
<!-- module:subagent-dispatch -->
- **Subagent dispatch** — см. `.claude/rules/subagent-dispatch.md`.
<!-- /module -->
<!-- module:safety -->
- **Safety** — см. `.claude/rules/safety.md`.
<!-- /module -->
<!-- module:versioning -->
- **Versioning** — см. `.claude/rules/versioning.md`.
<!-- /module -->
<!-- module:glossary -->
- **Glossary** — см. `.claude/rules/glossary.md`.
<!-- /module -->
```

- [ ] **Step 3: Создать `GEMINI.md.tmpl`**

Та же структура и тот же набор блоков, шапка роли — ревьюер:

```markdown
# {{PROJECT_NAME}} — инструкции (ревьюер)

> Канон — `CLAUDE.md`. Этот файл задаёт роль ревьюера: проверка изменений на соответствие правилам перед слиянием.
> Стек: {{STACK}}. Конвенции: {{CONVENTIONS}}.

## Активные модули

<!-- module:operator-gate -->
- **Operator gate** — см. `.claude/rules/operator-gate.md`.
<!-- /module -->
<!-- module:retro-loop -->
- **Retro loop** — см. `.claude/rules/retro-loop.md`.
<!-- /module -->
<!-- module:worktree-workflow -->
- **Worktree workflow** — см. `.claude/rules/worktree-workflow.md`.
<!-- /module -->
<!-- module:pr-policy -->
- **PR policy** — см. `.claude/rules/pr-policy.md`.
<!-- /module -->
<!-- module:review-loop -->
- **Review loop** — см. `.claude/rules/review-loop.md`.
<!-- /module -->
<!-- module:subagent-dispatch -->
- **Subagent dispatch** — см. `.claude/rules/subagent-dispatch.md`.
<!-- /module -->
<!-- module:safety -->
- **Safety** — см. `.claude/rules/safety.md`.
<!-- /module -->
<!-- module:versioning -->
- **Versioning** — см. `.claude/rules/versioning.md`.
<!-- /module -->
<!-- module:glossary -->
- **Glossary** — см. `.claude/rules/glossary.md`.
<!-- /module -->
```

- [ ] **Step 4: Проверить баланс маркеров во всех трёх шаблонах**

Run: `node -e "import('./skills/init/lib/blocks.mjs').then(m=>{const fs=require('node:fs');for(const f of ['CLAUDE','AGENTS','GEMINI']){m.filterModuleBlocks(fs.readFileSync('templates/instructions/'+f+'.md.tmpl','utf8'),[]);console.log(f+': markers balanced')}})" --input-type=commonjs`

Альтернатива (надёжнее) — положиться на инвариант-тест Task 11b, который проверяет баланс блоков и совпадение их множества с реестром по всем шаблонам. Если строка выше неудобна в среде, ограничиться проверкой в Task 11b.
Expected: для каждого шаблона `filterModuleBlocks(..., [])` не бросает (все блоки закрыты).

- [ ] **Step 5: Commit**

```bash
git add templates/instructions/
git commit -m "feat: role-based instruction templates with module blocks"
```

### Task 10: Правила (9 файлов) — дистилляция из eve

Каждое правило: frontmatter (`globs`/`class`) + дисциплинарный текст из eve **дословно**, проектная специфика → `{{PLACEHOLDERS}}` (`{{REVIEW_BOT}}`, `{{PR_TOOL}}`, пути, имена) или нейтральные формулировки. `safety.md` — **скелет** (заголовки-паттерны kill-switch/PII/consent + guidance, контент = TODO), без чужих доменных инвариантов (спека §8).

**Files (создать каждый):**
- `templates/rules/operator-gate.md`
- `templates/rules/retro-loop.md`
- `templates/rules/worktree-workflow.md`
- `templates/rules/pr-policy.md`
- `templates/rules/review-loop.md`
- `templates/rules/subagent-dispatch.md`
- `templates/rules/safety.md`
- `templates/rules/versioning.md`
- `templates/rules/glossary.md`

Шаблон frontmatter (применить к каждому):

```markdown
---
globs: "{{GLOBS}}"
class: discipline
---

# <Module title>

<дисциплинарный текст, дистиллированный из eve, с плейсхолдерами>
```

- [ ] **Step 1: operator-gate.md** — перенести дисциплину подтверждения деструктивных/наружу-направленных действий из `eve/.claude/rules/` (соответствующее правило). Проектные имена → нейтральные.
- [ ] **Step 2: retro-loop.md** — цикл `наблюдение → retro-*.md → ideas_4_rules.md (n-счёт) → промоут → очистка` (спека §6, eve-источник). Это identity feature; описывает контракт, который реализует скилл `ivk retro` (План B).
- [ ] **Step 3: worktree-workflow.md** — изоляция в git worktrees из eve. `{{PR_TOOL}}` вместо конкретного инструмента.
- [ ] **Step 4: pr-policy.md** — политика веток/PR из eve. `{{PR_TOOL}}`, `{{DEFAULT_BRANCH}}`.
- [ ] **Step 5: review-loop.md** — цикл ревью; `{{REVIEW_BOT}}` вместо имени бота.
- [ ] **Step 6: subagent-dispatch.md** — subagent-driven стиль из eve.
- [ ] **Step 7: safety.md** — **скелет**: заголовки kill-switch / PII / consent + guidance-подсказки, тело каждого раздела = `TODO: заполнить под проект`. Без переноса eve-доменных инвариантов.
- [ ] **Step 8: versioning.md** — версионирование промптов/контрактов из eve.
- [ ] **Step 9: glossary.md** — канон терминов; тело — скелет-таблица `термин | определение` с примером-плейсхолдером.
- [ ] **Step 10: Проверить, что у каждого правила есть frontmatter с `class`**

Run: `node --test skills/init/test/registry.test.mjs` (реестр уже ссылается на эти файлы; проверка их существования — в Task 11b)
Также вручную: открыть каждый файл, убедиться в наличии frontmatter и отсутствии незаменённой проектной специфики (имена eve, домен).

- [ ] **Step 11: Commit**

```bash
git add templates/rules/
git commit -m "feat: distilled rule templates for 9 modules"
```

### Task 11: Seed-файлы

**Files:**
- Create: `templates/seed/ideas_4_rules.md`
- Create: `templates/seed/retro-template.md`

- [ ] **Step 1: Создать пустой inbox**

`templates/seed/ideas_4_rules.md`:

```markdown
# ideas_4_rules — inbox эволюции правил

> Накопитель кандидатов в правила. Заполняется скиллом `ivk retro` (n-счёт независимых прецедентов). Пусто на старте.

## Активные кандидаты

_(пусто)_

## Лог обработки

_(пусто)_
```

- [ ] **Step 2: Создать шаблон retro-черновика**

`templates/seed/retro-template.md`:

```markdown
# retro-{{BRANCH}} — черновик наблюдений

> Сырые наблюдения по ветке. `ivk retro` сводит их в `ideas_4_rules.md`.

## Наблюдения

- 
```

- [ ] **Step 3: Commit**

```bash
git add templates/seed/
git commit -m "feat: seed files — ideas inbox and retro draft template"
```

### Task 11b: Инвариант — реестр ↔ файлы ↔ шаблоны согласованы

Ловит то, что smoke (Task 12, только recommended-профиль) пропускает: битую ссылку на любой из 9 rule-файлов и рассинхрон `modules.json` ↔ инструкц-шаблоны. Проверяет **все** модули, не только выбранные.

**Files:**
- Create: `skills/init/test/consistency.test.mjs`

- [ ] **Step 1: Написать инвариант-тест**

`skills/init/test/consistency.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry, validateRegistry } from '../lib/registry.mjs'
import { ENGINE_FILES } from '../lib/scaffold.mjs'
import { listModuleBlockIds } from '../lib/blocks.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const registry = validateRegistry(loadRegistry(join(ROOT, 'modules.json')))
const registryIds = new Set(Object.keys(registry))

test('every registry[id].files exists under templates/', () => {
  for (const [id, mod] of Object.entries(registry)) {
    for (const rel of mod.files) {
      assert.ok(existsSync(join(ROOT, 'templates', rel)), `missing template for ${id}: ${rel}`)
    }
  }
})

test('each engine template declares exactly the registry module set', () => {
  for (const engine of Object.keys(ENGINE_FILES)) {
    const tmplPath = join(ROOT, 'templates', 'instructions', ENGINE_FILES[engine].tmpl)
    assert.ok(existsSync(tmplPath), `missing template ${ENGINE_FILES[engine].tmpl}`)
    const ids = listModuleBlockIds(readFileSync(tmplPath, 'utf8'))
    // нет блока на несуществующий модуль И каждый модуль реестра представлен
    assert.deepEqual(ids, registryIds, `${engine}: block ids must equal registry ids`)
  }
})
```

- [ ] **Step 2: Запустить — убедиться, что проходит**

Run: `node --test skills/init/test/consistency.test.mjs`
Expected: PASS — 2 теста. Если падает — значит в `modules.json`, `templates/rules/` или инструкц-шаблоне есть рассинхрон; исправить источник.

- [ ] **Step 3: Commit**

```bash
git add skills/init/test/consistency.test.mjs
git commit -m "test(init): registry ↔ files ↔ templates consistency invariant"
```

### Task 12: Smoke — прогон helper на реальном контенте

Сквозная проверка CLI на настоящих шаблонах/реестре в temp-каталоге.

**Files:**
- Create: `skills/init/test/smoke.test.mjs`

- [ ] **Step 1: Написать smoke-тест, вызывающий CLI**

`skills/init/test/smoke.test.mjs`:

```js
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
```

- [ ] **Step 2: Запустить весь набор тестов**

Run: `npm test`
Expected: PASS — все файлы, включая `smoke.test.mjs` (2 теста).

- [ ] **Step 3: Commit**

```bash
git add skills/init/test/smoke.test.mjs
git commit -m "test(init): end-to-end CLI smoke on real templates and registry"
```

---

## Phase 3 — Скилл и упаковка

### Task 13: `skills/init/SKILL.md` — тонкий оркестратор

SKILL.md описывает операторский протокол; механику делегирует helper'у. Не дублирует логику резолва/копирования.

**Files:**
- Create: `skills/init/SKILL.md`

- [ ] **Step 1: Создать SKILL.md**

```markdown
---
name: init
description: Скаффолдер invoker — раскладывает выбранный дисциплинарный субстрат и модули в текущий проект. Use when the user wants to bootstrap invoker in a project, run `ivk init`, or set up agent rules/instructions.
---

# ivk init — скаффолдер

Каноническое имя вызова — `/invoker:init`; в прозе — `ivk init`.

Раскладывает субстрат invoker в текущий проект. **Не генерирует текст** — копирует выверенные шаблоны дословно. Вопросы — только про возможности плагина, не про значения проекта. Плейсхолдеры (`{{...}}`) оставляет оператору.

## Протокол

1. **Покажи сгруппированный чеклист модулей** (4 активных блока; Context scaling/runbooks — вне MVP, не предлагать):
   - **Base discipline:** operator-gate, retro-loop *(recommended — предотмечены)*
   - **Git/PR workflow:** worktree-workflow, pr-policy, review-loop
   - **Subagent workflow:** subagent-dispatch
   - **Project governance:** safety, versioning, glossary

   Рядом с каждым — `note` из реестра. Recommended предотмечены, но снимаемы (не silent install). **Вопросов про проект не задавай.**

2. **Спроси про движки** (capability-вопрос): CLAUDE.md — всегда; AGENTS.md / GEMINI.md — по выбору.

3. **Покажи резолв зависимостей** перед записью. Запусти:
   `node skills/init/helper.mjs resolve --modules <выбранные через запятую>`
   Покажи оператору `resolved` и `added` (что дотянул каскад). Дождись подтверждения.

4. **Примени** после подтверждения:
   `node skills/init/helper.mjs apply --target <корень проекта> --engines <claude[,agents][,gemini]> --modules <выбранные>`

5. **Отчёт:** перечисли созданные файлы (из вывода helper'а) и предупреди про оставшиеся `{{placeholders}}` / TODO в инструкц-файлах и `safety.md`. **Плейсхолдеры init не заполняет** — это работа оператора.

## Гарантии

- Правила копируются дословно (байт-в-байт).
- Инструкц-файлы собираются включением/исключением размеченных блоков `<!-- module:<id> -->`, текст не синтезируется.
- Реестр `modules.json` в проект не копируется; пишется слепок `.invoker/modules.json`.
```

- [ ] **Step 2: Проверить, что скилл обнаруживается (структурная проверка frontmatter)**

Run: `node -e "const fs=require('node:fs');const s=fs.readFileSync('skills/init/SKILL.md','utf8');if(!/^---[\s\S]*name:\s*init[\s\S]*---/.test(s))throw new Error('SKILL.md frontmatter invalid');console.log('SKILL.md frontmatter ok')"`
Expected: `SKILL.md frontmatter ok`.

- [ ] **Step 3: Commit**

```bash
git add skills/init/SKILL.md
git commit -m "feat(init): thin orchestrator SKILL.md"
```

### Task 14: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Создать README**

```markdown
# invoker

Claude Code plugin: дисциплинарный слой + движок эволюции правил для AI-агентов в любом проекте. Дистилляция переносимой «агентной ОС».

## Установка

Подключи плагин в Claude Code, затем в целевом проекте запусти `/invoker:init`.

## Скиллы

- **`ivk init`** (`/invoker:init`) — скаффолдер: раскладывает выбранный субстрат и модули в проект.
- **`ivk retro`** (`/invoker:retro`) — движок эволюции правил *(в разработке, см. План B)*.

## Разработка

```bash
npm test   # node --test skills/init/test/
```

Дизайн: `docs/specs/2026-06-15-invoker-design.md`. План: `docs/plans/2026-06-16-invoker-init.md`.
```

- [ ] **Step 2: Финальный прогон всех тестов**

Run: `npm test`
Expected: PASS — весь набор.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: project README"
```

---

## Self-Review

**1. Spec coverage:**
- §2 MVP «скиллы init и retro» → init покрыт (этот план); retro — План B (намеренно вне scope). ✓
- §2 «каталог шаблонов (субстрат + модули)» → Tasks 8–11. ✓
- §2 «декларативный реестр modules.json» → Task 8. ✓
- §2 «multi-engine эмиссия без транспайлера» → Task 9 (ролевые шаблоны) + ENGINE_FILES (Task 5). ✓
- §3.1 анатомия плагина → File Structure + Tasks 1, 6, 13. ✓
- §3.2 реестр (title/group/default/files/depends_on/note) → Task 8 схема. ✓
- §3.3 слепок `.invoker/modules.json` (selected vs resolved) → Task 5 buildSnapshot + Task 6 apply. ✓
- §4 обязательный субстрат + 9 модулей + каскад → Tasks 8, 10; каскад review-loop→pr-policy→worktree-workflow проверен (Tasks 3, 8, 12). Целостность реестр↔файлы↔шаблоны (все 9 модулей, не только recommended) → инвариант Task 11b. ✓
- §4 recommended-профиль предотмечен, снимаем → SKILL.md (Task 13). ✓
- §5 поток init (10 шагов) → helper apply (Task 6) + SKILL.md протокол (Task 13). ✓
- §5 шаг 7 вырезание блоков, текст не синтезируется → Task 4. ✓
- §7 три ролевых шаблона + общий include «факты проекта» → Task 9. ✓
- §8 универсализация (плейсхолдеры, safety = скелет) → Tasks 9–10. ✓
- Вне MVP (runbooks, requires/conflicts/maturity) → не реализуются. ✓

**2. Placeholder scan:** Node-код в Tasks 2–7, 12 приведён полностью. Контент-задачи (10) дают точный источник (eve-путь), правило универсализации и критерий — это авторская дистилляция, не дыра в плане; `{{PLACEHOLDERS}}` здесь — фича продукта (§8), а не TODO. modules.json, шаблоны инструкций, seed, SKILL.md, README приведены целиком.

**3. Type/имена-consistency:** `resolveDependencies(registry, selected) → resolved[]`; `validateRegistry`/`loadRegistry`; `filterModuleBlocks(text, keepIds)`/`listModuleBlockIds(text) → Set`; `copyRules`/`renderInstruction`/`buildSnapshot`/`writeFileEnsured`/`ENGINE_FILES` — имена согласованы между Tasks 2–7 и вызовами в helper (Task 6) и тестах (Tasks 7, 11b, 12). Копирование правил — `copyFileSync` (байт-в-байт, П.3); гарантия в SKILL.md соответствует реализации. Поля слепка (`plugin`/`plugin_version`/`engines`/`selected_modules`/`resolved_modules`/`created_at`) совпадают между Task 5 и спекой §3.3.
```
