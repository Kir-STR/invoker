import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL = join(dirname(fileURLToPath(import.meta.url)), '..', 'SKILL.md')

test('retro SKILL.md exists with name frontmatter', () => {
  assert.ok(existsSync(SKILL), 'skills/retro/SKILL.md must exist')
  const src = readFileSync(SKILL, 'utf8')
  assert.match(src, /^---\r?\n(?:[\s\S]*?\r?\n)?name:\s*retro\b/, 'frontmatter must declare name: retro')
})

test('retro skill targets the .invoker service zone, not legacy .claude paths', () => {
  const src = readFileSync(SKILL, 'utf8')
  // ported paths present
  assert.ok(src.includes('.invoker/ideas_4_rules.md'), 'must reference .invoker/ideas_4_rules.md')
  assert.ok(src.includes('.invoker/retro/'), 'must reference .invoker/retro/ drafts')
  // legacy .claude-based locations must be gone (autoload-polluting staging, flat draft files)
  assert.ok(!src.includes('.claude/retro-'), 'must not use legacy .claude/retro-*.md draft path')
  assert.ok(!src.includes('.claude/ideas_4_rules'), 'must not use legacy .claude/ideas_4_rules.md staging path')
})

test('retro skill states the self-edit gate (staging-only by default)', () => {
  const src = readFileSync(SKILL, 'utf8')
  assert.ok(src.includes('Не правь сам'), 'must state it does not edit instructions itself')
  assert.ok(/Единственный файл, который пишешь ты/.test(src), 'must name staging as the only file it writes')
})
