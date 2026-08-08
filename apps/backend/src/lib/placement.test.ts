/* Placement scoring (scorePlacement, in @koodakbook/shared) — turns the probe
 * answer vector into a starting level + per-strand levels. Web and mobile both
 * call this one function, so it's the single behaviour under test. A wrong
 * placement mis-levels a child on day one, so these assert the intended mapping.
 *
 * Tested from the backend runner because it already resolves the shared package
 * and runs node:test; the function itself is client-shared code.
 *
 * Run: npm test */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scorePlacement, PLACEMENT_STRAND_ORDER } from '@koodakbook/shared'

// ── Boundary: no items correct ──────────────────────────────────────────────

test('0 correct → level 1 and every strand at 1', () => {
  assert.deepEqual(scorePlacement([false, false, false, false]), {
    level: 1,
    strands: { V: 1, D: 1, F: 1, C: 1 },
  })
})

test('an empty answer vector (probe skipped) → level 1, all strands 1', () => {
  assert.deepEqual(scorePlacement([]), { level: 1, strands: { V: 1, D: 1, F: 1, C: 1 } })
})

// ── Boundary: all items correct ─────────────────────────────────────────────

test('all 4 correct → level 4, and each strand lifted to 2 (never higher)', () => {
  // NOTE: overall level reaches 4 while every strand caps at 2. Whether that
  // asymmetry is the intended design is an OPEN question flagged in the SR/
  // placement review — this test characterises the current mapping; it is not
  // an endorsement of the divergence.
  assert.deepEqual(scorePlacement([true, true, true, true]), {
    level: 4,
    strands: { V: 2, D: 2, F: 2, C: 2 },
  })
})

// ── The streak → level mapping (1 + leading correct run, capped at 4) ───────

test('level is 1 + the leading correct streak', () => {
  assert.equal(scorePlacement([true, false, false, false]).level, 2)
  assert.equal(scorePlacement([true, true, false, false]).level, 3)
  assert.equal(scorePlacement([true, true, true, false]).level, 4)
})

test('level is capped at 4 — a 3-streak and a 4-streak both yield level 4', () => {
  assert.equal(scorePlacement([true, true, true, false]).level, 4)
  assert.equal(scorePlacement([true, true, true, true]).level, 4)
})

// ── Per-strand: a passed item lifts that strand to 2, a missed one leaves 1 ──

test('each strand maps to its own answer: pass → 2, miss → 1', () => {
  assert.deepEqual(scorePlacement([true, false, true, false]).strands, { V: 2, D: 1, F: 2, C: 1 })
  assert.deepEqual(scorePlacement([false, true, false, true]).strands, { V: 1, D: 2, F: 1, C: 2 })
})

// ── The positional contract: answers[i] ↔ PLACEMENT_STRAND_ORDER[i] ─────────

test('answer index maps to strand by PLACEMENT_STRAND_ORDER (V,D,F,C)', () => {
  // Guards the fragile positional coupling: if the probe order in placement.ts
  // ever changes, this order constant must change with it or scoring mis-maps.
  assert.deepEqual([...PLACEMENT_STRAND_ORDER], ['V', 'D', 'F', 'C'])
  // A single correct answer at position i lifts exactly the i-th strand.
  PLACEMENT_STRAND_ORDER.forEach((strand, i) => {
    const answers = [false, false, false, false]
    answers[i] = true
    const { strands } = scorePlacement(answers)
    assert.equal(strands[strand], 2, `position ${i} lifts ${strand}`)
    for (const other of PLACEMENT_STRAND_ORDER) {
      if (other !== strand) assert.equal(strands[other], 1, `${other} untouched`)
    }
  })
})
