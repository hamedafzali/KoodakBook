import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isMp4Head, formatDuration } from './videoFile'

test('isMp4Head accepts an ftyp box', () => {
  const head = Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])
  assert.equal(isMp4Head(head), true)
})

test('isMp4Head rejects zip, webm and short buffers', () => {
  assert.equal(isMp4Head(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])), false)
  assert.equal(isMp4Head(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])), false)
  assert.equal(isMp4Head(Buffer.from('ftyp')), false)
})

test('formatDuration', () => {
  assert.equal(formatDuration(8), '0:08')
  assert.equal(formatDuration(65.3), '1:05')
  assert.equal(formatDuration(null), '')
  assert.equal(formatDuration(0), '')
})
