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
