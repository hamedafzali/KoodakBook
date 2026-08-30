/* Repeated-failure detection (the "frustration loop"). Pure decision layer,
 * same shape as gate.ts: no DB, no env access — the route/DB layer reads env
 * and passes a config in, so this stays unit-testable without a database.
 *
 * The expert review flagged repeated-failure churn as the biggest engagement
 * risk for 4-7 year olds: today a miss just drops the Leitner box to 1 with
 * no other reaction (see leitner.ts). This adds a THREE-STAGE graduated
 * response, keyed off consecutive_misses (mig-051), receptive track only —
 * it follows the same track boundary BUG-A already enforces, since the only
 * consumer is the receptive review queue.
 *
 *   stage 1 (>= easeThreshold)    ease mode/distractors next time (review.tsx)
 *   stage 2 (>= reteachThreshold) re-teach beat before the next attempt (review.tsx)
 *   stage 3 (>  reteachThreshold, i.e. still wrong right after a re-teach)
 *                                 bench the word longer than the normal
 *                                 box-1 interval, so it doesn't loop back
 *                                 tomorrow for another loss
 *
 * All of this is ADDITIVE on top of the Leitner ladder — box still resets to
 * 1 on a miss exactly as before; only the due-date push and the frontend's
 * presentation of the word change.
 */

export interface FrustrationConfig {
  easeThreshold: number
  reteachThreshold: number
  benchIntervalDays: number
}

// Provisional defaults — EVERY ONE of these is an unvalidated guess, not
// derived from any data on real children, exactly like DEFAULT_PRIOR_K in
// gate.ts. When real usage data exists, these three numbers are the first
// thing to revisit — a pilot can override them via env (see frustrationConfig
// in strands.ts-adjacent DB layer) without a release.
export const DEFAULT_EASE_THRESHOLD = 2
export const DEFAULT_RETEACH_THRESHOLD = 4
export const DEFAULT_BENCH_INTERVAL_DAYS = 3

export const DEFAULT_FRUSTRATION_CONFIG: FrustrationConfig = {
  easeThreshold: DEFAULT_EASE_THRESHOLD,
  reteachThreshold: DEFAULT_RETEACH_THRESHOLD,
  benchIntervalDays: DEFAULT_BENCH_INTERVAL_DAYS,
}

/** Next consecutive_misses value: reset on correct, +1 on a miss. */
export function nextConsecutiveMisses(prev: number, correct: boolean): number {
  return correct ? 0 : prev + 1
}

/**
 * The due-date interval to actually use for a receptive miss. Normally this
 * is just the standard box-1 interval (1 day, see leitner.ts). Once a word
 * has already gone through a re-teach and is STILL missed
 * (consecutiveMisses > reteachThreshold), push it further out so the child
 * isn't handed the same losing item again tomorrow.
 */
export function missIntervalDays(
  consecutiveMisses: number,
  standardIntervalDays: number,
  config: FrustrationConfig,
): number {
  return consecutiveMisses > config.reteachThreshold ? config.benchIntervalDays : standardIntervalDays
}

/** Presentation flags the review endpoint attaches to each due word. */
export interface FrustrationFlags {
  /** Force the easier mode + more distinct distractors. */
  easing: boolean
  /** Show a no-scoring re-teach beat before the next quiz attempt on this word. */
  needsReteach: boolean
}

export function frustrationFlags(consecutiveMisses: number, config: FrustrationConfig): FrustrationFlags {
  return {
    easing: consecutiveMisses >= config.easeThreshold,
    needsReteach: consecutiveMisses >= config.reteachThreshold,
  }
}
