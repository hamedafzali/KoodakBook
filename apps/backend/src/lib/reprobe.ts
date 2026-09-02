/* Re-placement scheduling (docs/re-placement-flow-design.md §1). Pure decision
 * layer, same shape as gate.ts/frustration.ts: no DB, no env access, no Date.now()
 * — the route reads env + the clock and passes both in, so this stays
 * unit-testable without a database or a mocked clock library.
 *
 * The gate already self-corrects continuously from mastery evidence
 * (strands.ts's promoteStrands, on every lesson/story completion). Re-placement
 * exists ONLY to refresh the prior for strands where that organic evidence isn't
 * arriving on its own (a neglected strand, or a long absence) — it is a top-up
 * for the recompute loop, not a replacement for it. See design doc §1 for why
 * this is a lazy elapsed-time check rather than a milestone or a push.
 */

export interface ReprobeConfig {
  intervalDays: number
  jitterDays: number
}

// Provisional defaults — EVERY ONE of these is an unvalidated guess, exactly
// like DEFAULT_PRIOR_K in gate.ts (see design doc §6, A10/A11).
export const DEFAULT_REPROBE_INTERVAL_DAYS = 63 // 9 weeks — midpoint of the 8–12 week ask
export const DEFAULT_REPROBE_JITTER_DAYS = 14   // spreads a cohort placed in one launch window

export const DEFAULT_REPROBE_CONFIG: ReprobeConfig = {
  intervalDays: DEFAULT_REPROBE_INTERVAL_DAYS,
  jitterDays: DEFAULT_REPROBE_JITTER_DAYS,
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Deterministic [0, 1) hash of a string — stable across calls/processes, no
 *  randomness, so a child's jitter offset never changes between checks and the
 *  function stays pure and testable with fixed ids. Not cryptographic; it only
 *  needs to spread a cohort, not resist adversarial input. */
function hashUnit(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // >>> 0 forces unsigned; dividing by 2^32 maps to [0, 1).
  return (h >>> 0) / 4294967296
}

/** This child's actual interval, base ± jitter, deterministic from child_id so
 *  a whole cohort placed the same week doesn't come due the same week too. */
export function reprobeIntervalDays(childId: string, config: ReprobeConfig): number {
  const offset = (hashUnit(childId) * 2 - 1) * config.jitterDays // in [-jitter, +jitter)
  return Math.max(1, Math.round(config.intervalDays + offset))
}

/** Whether a re-placement activity should be offered now. Pure function of
 *  elapsed time — no due-date accumulates urgency and none ever "expires";
 *  it's simply available once true, exactly like any other activity (§2). */
export function isReprobeDue(
  lastPlacementAt: Date,
  now: Date,
  childId: string,
  config: ReprobeConfig = DEFAULT_REPROBE_CONFIG,
): boolean {
  const elapsedDays = (now.getTime() - lastPlacementAt.getTime()) / DAY_MS
  return elapsedDays >= reprobeIntervalDays(childId, config)
}

/** The calendar date a child next becomes eligible — for surfacing "not yet
 *  due" state to admin/debugging without re-deriving the arithmetic there. */
export function nextEligibleAt(lastPlacementAt: Date, childId: string, config: ReprobeConfig = DEFAULT_REPROBE_CONFIG): Date {
  return new Date(lastPlacementAt.getTime() + reprobeIntervalDays(childId, config) * DAY_MS)
}
