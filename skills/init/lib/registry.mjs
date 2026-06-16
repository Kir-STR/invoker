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
