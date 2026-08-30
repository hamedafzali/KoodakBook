/* Leitner box → next-review schedule (the SR ladder). Single source of truth
 * for the box transition and the day-interval per destination box.
 *
 * routes/progress.ts calls this (via planWordProgress in wordProgress.ts) and
 * writes the returned box/intervalDays verbatim in its SQL upsert — the SQL
 * itself contains no transition logic, so there is exactly one implementation
 * of the ladder. (An earlier version of this comment warned that the route
 * re-derived the transition inline; that duplication was already gone by the
 * time this was checked — planWordProgress is the actual single source.)
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
