/* Spaced-repetition ladder (leitnerNext) — the box transition + day-interval
 * that schedules every word review. A mis-scheduled review degrades learning
 * invisibly, so these assert the INTENDED schedule (project.md §11.1: intervals
 * 1,2,4,7,16 per destination box), not merely whatever a given call returns.
 *
 * SCOPE: this covers the pure ladder. The live scheduler expresses the same
 * rules in SQL (routes/progress.ts); keeping them in lock-step is what these
 * lock down. The SQL itself needs a DB integration test (see SR review notes).
 *
 * Run: npm test */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leitnerNext, LEITNER_MAX_BOX } from './leitner'

// ── The interval schedule, box by box ──────────────────────────────────────

test('a correct rep advances one box and schedules per the 1,2,4,7,16 ladder', () => {
  assert.deepEqual(leitnerNext(1, true), { box: 2, intervalDays: 2 })
  assert.deepEqual(leitnerNext(2, true), { box: 3, intervalDays: 4 })
  assert.deepEqual(leitnerNext(3, true), { box: 4, intervalDays: 7 })
  assert.deepEqual(leitnerNext(4, true), { box: 5, intervalDays: 16 })
})

test('a word entering box 1 (first legacy/receptive rep) is due in 1 day', () => {
  // The legacy/receptive track inserts a new word directly at box 1.
  assert.deepEqual(leitnerNext(0, true), { box: 1, intervalDays: 1 })
})

// ── Floor: a miss always resets to box 1 / 1 day, from ANY box ──────────────

test('a miss drops the word to box 1 and resurfaces it tomorrow, from any box', () => {
  for (const box of [0, 1, 2, 3, 4, 5]) {
    assert.deepEqual(leitnerNext(box, false), { box: 1, intervalDays: 1 }, `miss from box ${box}`)
  }
})

test('box 1 is the floor — a miss at box 1 stays at box 1, not below', () => {
  assert.deepEqual(leitnerNext(1, false), { box: 1, intervalDays: 1 })
})

// ── Ceiling: box 5 is the cap, correct reps do not overflow it ──────────────

test('box 5 is the ceiling — a correct rep at box 5 stays at box 5 (16-day cadence)', () => {
  assert.deepEqual(leitnerNext(5, true), { box: 5, intervalDays: 16 })
  assert.equal(LEITNER_MAX_BOX, 5)
})

test('reaching box 5 (mastery cadence) happens exactly at box 4 → 5', () => {
  assert.equal(leitnerNext(4, true).box, LEITNER_MAX_BOX)
  assert.equal(leitnerNext(3, true).box < LEITNER_MAX_BOX, true, 'box 3 → 4 is not yet the ceiling')
})

// ── Productive track starts from 0 (coalesce), legacy from 1 ────────────────

test('the productive track starts from box 0, so its first correct rep lands in box 1', () => {
  // SQL: least(coalesce(box_productive,0)+1, 5). First productive rep: 0 → 1.
  assert.deepEqual(leitnerNext(0, true), { box: 1, intervalDays: 1 })
  // Its second correct rep then advances to box 2, same ladder as any other track.
  assert.deepEqual(leitnerNext(1, true), { box: 2, intervalDays: 2 })
})
