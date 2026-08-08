/* Leitner box → next-review schedule (the SR ladder). Single source of truth
 * for the box transition and the day-interval per destination box.
 *
 * NOTE (verification honesty): the live scheduler in routes/progress.ts runs
 * this transition INSIDE an atomic SQL upsert, not by calling this function —
 * so these are the same rules expressed twice. This module exists to make the
 * ladder unit-testable and to be the documented spec the SQL must match; keep
 * the two in lock-step until the route is refactored to compute the schedule
 * here (see BUG notes in the SR review). A DB-level integration test is the
 * only thing that verifies the SQL itself.
 *
 * Intervals per DESTINATION box (project.md §11.1): 1,2,4,7,16 days. */

export const LEITNER_MAX_BOX = 5
const INTERVAL_DAYS_BY_BOX: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 16 }

export interface LeitnerNext {
  box: number
  intervalDays: number
}

/**
 * Given the current box and whether this rep was correct, return the next box
 * and the day-interval until the word is due again.
 *
 * - Correct: advance one box, capped at 5 (mastered cadence).
 * - Miss:    drop to box 1 and resurface tomorrow — regardless of prior box.
 *
 * `prevBox` is the box BEFORE this rep. Pass 0 for a word never seen on this
 * track (the productive track starts from 0 via coalesce; the legacy/receptive
 * track's first rep is inserted directly at box 1). A correct rep from box 0
 * therefore lands in box 1, matching the SQL's least(coalesce(box,0)+1, 5).
 */
export function leitnerNext(prevBox: number, correct: boolean): LeitnerNext {
  const box = correct ? Math.min(prevBox + 1, LEITNER_MAX_BOX) : 1
  return { box, intervalDays: INTERVAL_DAYS_BY_BOX[box] }
}
