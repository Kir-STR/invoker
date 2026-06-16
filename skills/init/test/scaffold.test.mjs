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

    const written = copyRules(reg, ['a'], src, join(dst, '.claude', 'rules'))
    assert.deepEqual(written, ['a.md'])

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
