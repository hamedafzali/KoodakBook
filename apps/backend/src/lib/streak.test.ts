import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStreak } from './streak'

test('consecutive days including today counts fully', () => {
  assert.equal(computeStreak(['2026-09-04', '2026-09-03', '2026-09-02'], '2026-09-04'), 3)
})

test('no session today yet still counts the run through yesterday (grace)', () => {
  assert.equal(computeStreak(['2026-09-03', '2026-09-02'], '2026-09-04'), 2)
})

test('one missed day is forgiven once', () => {
  // today has a session; the 3rd was missed; the run continues before that.
  assert.equal(
    computeStreak(['2026-09-04', '2026-09-02', '2026-09-01', '2026-08-31'], '2026-09-04'),
    4
  )
})

test('two missed days in a row breaks the streak even with grace', () => {
  assert.equal(computeStreak(['2026-09-01', '2026-08-31'], '2026-09-04'), 0)
})

test('grace is spent only once, not once per gap', () => {
  // gap between 09-04(today, no session) -> 09-03 (grace) is fine, but then
  // 09-02 is missing and 09-01 has a session: that is a second gap, no grace left.
  assert.equal(computeStreak(['2026-09-03', '2026-09-01'], '2026-09-04'), 1)
})

test('no sessions at all is a zero streak', () => {
  assert.equal(computeStreak([], '2026-09-04'), 0)
})

test('empty gap-free single session today', () => {
  assert.equal(computeStreak(['2026-09-04'], '2026-09-04'), 1)
})
