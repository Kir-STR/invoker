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
      const val = argv[i + 1]
      if (val === undefined || val.startsWith('--')) {
        throw new Error(`flag ${argv[i]} requires a value`)
      }
      flags[argv[i].slice(2)] = val
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

  // Валидируем движки ДО любых записей — плохой ввод не должен оставлять проект частично инициализированным.
  for (const engine of engines) {
    if (!ENGINE_FILES[engine]) throw new Error(`Unknown engine: ${engine}`)
  }

  const created = []

  // 1. Правила (дословная копия)
  const ruleFiles = copyRules(registry, resolved, join(PLUGIN_ROOT, 'templates'), join(target, '.claude', 'rules'))
  for (const name of ruleFiles) created.push(`.claude/rules/${name}`)

  // 2. Инструкц-файлы под выбранные движки
  for (const engine of engines) {
    const map = ENGINE_FILES[engine]
    const tmpl = readFileSync(join(PLUGIN_ROOT, 'templates', 'instructions', map.tmpl), 'utf8')
    writeFileEnsured(join(target, map.out), renderInstruction(tmpl, resolved))
    created.push(map.out)
  }

  // 3. Seed в служебную зону .invoker/: пустой inbox всегда; retro-template если выбран retro-loop.
  // Вся служебная инфра invoker живёт в .invoker/ (рядом со слепком modules.json), .claude/ —
  // только под нативные Claude Code rules. Шаблон лежит в .invoker/retro-template.md (вне подпапки
  // .invoker/retro/, куда retro (План B) пишет черновики), иначе retro проглотил бы свой же seed.
  writeFileEnsured(
    join(target, '.invoker', 'ideas_4_rules.md'),
    readFileSync(join(PLUGIN_ROOT, 'templates', 'seed', 'ideas_4_rules.md'), 'utf8'),
  )
  created.push('.invoker/ideas_4_rules.md')
  if (resolved.includes('retro-loop')) {
    writeFileEnsured(
      join(target, '.invoker', 'retro-template.md'),
      readFileSync(join(PLUGIN_ROOT, 'templates', 'seed', 'retro-template.md'), 'utf8'),
    )
    created.push('.invoker/retro-template.md')
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
try {
  const flags = parseFlags(rest)
  if (cmd === 'resolve') cmdResolve(flags)
  else if (cmd === 'apply') cmdApply(flags)
  else throw new Error(`Unknown command: ${cmd ?? '(none)'}. Use 'resolve' or 'apply'.`)
} catch (err) {
  process.stderr.write(`invoker init: ${err.message}\n`)
  process.exit(1)
}
