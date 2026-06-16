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
