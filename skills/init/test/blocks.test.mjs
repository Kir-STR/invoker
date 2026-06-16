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
