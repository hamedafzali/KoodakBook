/* Dual-track SR write routing (planWordProgress) — the decision that BUG-A was
 * hiding in. The live route used to run one always-on legacy upsert regardless of
 * track, so a PRODUCTIVE rep silently rewrote the RECEPTIVE review schedule. The
 * planner makes the routing pure; these tests lock the two tracks' independence
 * so the fix can't regress unnoticed.
 *
 * Pure module (wordProgress.ts) — no DB. Run: npm test */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planWordProgress, type WordProgressPrev } from './wordProgress'

const prev = (o: Partial<WordProgressPrev> = {}): WordProgressPrev => ({
  box: 1,
  status: 'practiced',
  mastered_at: null,
  box_productive: null,
  mastery: 'introduced',
  ...o,
})

// ── Receptive track (the legacy/authoritative schedule) ─────────────────────

test('first-ever receptive exposure enters box 1, due tomorrow, status as declared', () => {
  const p = planWordProgress(null, { track: 'receptive', correct: true, status: 'introduced' })
  assert.deepEqual(p.receptive, { box: 1, intervalDays: 1, status: 'introduced', stampMasteredAt: false })
  assert.equal(p.productive, null)
  assert.equal(p.mastery, 'introduced')
})

test('receptive correct climbs one box and lengthens the interval (2→3 = 4 days)', () => {
  const p = planWordProgress(prev({ box: 2 }), { track: 'receptive', correct: true, status: 'practiced' })
  assert.deepEqual(p.receptive, { box: 3, intervalDays: 4, status: 'practiced', stampMasteredAt: false })
})

test('receptive miss drops to box 1 / 1 day (floor) without unsetting a mastered status', () => {
  const p = planWordProgress(prev({ box: 4, status: 'mastered', mastered_at: 't' }), {
    track: 'receptive', correct: false, status: 'practiced',
  })
  assert.equal(p.receptive?.box, 1)
  assert.equal(p.receptive?.intervalDays, 1)
  assert.equal(p.receptive?.status, 'mastered', 'status is monotonic — a miss does not un-master')
  assert.equal(p.receptive?.stampMasteredAt, false)
})

test('receptive reaching box 5 correctly masters and stamps mastered_at once', () => {
  const first = planWordProgress(prev({ box: 4, status: 'practiced', mastered_at: null }), {
    track: 'receptive', correct: true, status: 'practiced',
  })
  assert.equal(first.receptive?.box, 5)
  assert.equal(first.receptive?.status, 'mastered')
  assert.equal(first.receptive?.stampMasteredAt, true)
  assert.equal(first.mastery, 'mastered')
  // Already mastered_at → do not re-stamp.
  const again = planWordProgress(prev({ box: 5, status: 'mastered', mastered_at: 't' }), {
    track: 'receptive', correct: true, status: 'practiced',
  })
  assert.equal(again.receptive?.box, 5, 'box 5 is the ceiling')
  assert.equal(again.receptive?.stampMasteredAt, false)
})

// ── Productive track (own schedule; BUG-A: never touches receptive) ─────────

test('first productive rep uses its own box (from 0), leaving the receptive schedule untouched', () => {
  const p = planWordProgress(prev({ box: 3, box_productive: null }), {
    track: 'productive', correct: true, status: 'practiced',
  })
  assert.equal(p.receptive, null, 'BUG-A: a productive rep must not write the receptive schedule')
  assert.deepEqual(p.productive, { box: 1, intervalDays: 1 })
  assert.equal(p.mastery, 'practicing')
})

test('productive correct climbs the productive box independently of the receptive box', () => {
  const p = planWordProgress(prev({ box: 1, box_productive: 3 }), {
    track: 'productive', correct: true, status: 'practiced',
  })
  assert.equal(p.receptive, null)
  assert.deepEqual(p.productive, { box: 4, intervalDays: 7 })
})

test('BUG-A guard: a productive MISS resets only the productive box — receptive is left alone', () => {
  // The child has a strong receptive schedule (box 5, mastered). Failing to
  // PRODUCE the word must not drag that receptive review back to box 1.
  const p = planWordProgress(prev({ box: 5, status: 'mastered', mastered_at: 't', box_productive: 4 }), {
    track: 'productive', correct: false, status: 'practiced',
  })
  assert.equal(p.receptive, null, 'the receptive schedule is not in the plan at all')
  assert.deepEqual(p.productive, { box: 1, intervalDays: 1 }, 'only the productive box resets')
})

test('productive mastery enriches to practicing but never downgrades mastered/consolidated', () => {
  assert.equal(
    planWordProgress(prev({ mastery: 'introduced' }), { track: 'productive', correct: true, status: 'practiced' }).mastery,
    'practicing',
  )
  assert.equal(
    planWordProgress(prev({ mastery: 'mastered' }), { track: 'productive', correct: false, status: 'practiced' }).mastery,
    'mastered', 'a productive miss must not undo mastery',
  )
  assert.equal(
    planWordProgress(prev({ mastery: 'consolidated' }), { track: 'productive', correct: true, status: 'practiced' }).mastery,
    'consolidated',
  )
})

// ── Track independence, stated as a property ────────────────────────────────

test('every productive interaction leaves plan.receptive null; every receptive one leaves plan.productive null', () => {
  for (const correct of [true, false]) {
    for (const box of [1, 3, 5]) {
      const pr = planWordProgress(prev({ box, box_productive: box }), { track: 'productive', correct, status: 'practiced' })
      assert.equal(pr.receptive, null)
      assert.notEqual(pr.productive, null)
      const re = planWordProgress(prev({ box, box_productive: box }), { track: 'receptive', correct, status: 'practiced' })
      assert.equal(re.productive, null)
      assert.notEqual(re.receptive, null)
    }
  }
})
