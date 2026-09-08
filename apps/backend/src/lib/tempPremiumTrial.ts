/* Free→temp-premium unlock: a growth mechanic, not a gating rule.
 *
 * A free-plan family that hits its daily AI-story cap on several distinct
 * days is bumping against the real limit of the free tier — the moment to
 * show them what premium feels like, not just tell them about it. Trigger
 * and cooldown are pure/testable here (no DB); routes/ai.ts owns the I/O
 * (recording a cap-hit, reading the hit streak and last grant, writing the
 * new plan/expiry) and calls into this module to decide.
 *
 * Reuses users.plan / plan_expires_at end-to-end: granting is just setting
 * those two columns, and isPremiumActive() (packages/shared) already treats
 * an expired plan_expires_at as a lapse back to free. No new gating path.
 */

export const TRIAL_TRIGGER_STREAK_DAYS = 3
export const TRIAL_DURATION_DAYS = 5
export const TRIAL_COOLDOWN_DAYS = 90
export const TRIAL_PLAN_KEY = 'premium_solo'

/**
 * `capHitDates`: distinct YYYY-MM-DD days (any order) this account was
 * blocked by its daily AI-story cap, including today's hit if it just
 * happened. `lastGrantedAt`: ISO timestamp of this account's most recent
 * temp-premium grant, or null if it's never had one. `now`: ISO timestamp.
 */
export function isTrialEligible(
  capHitDates: string[],
  lastGrantedAt: string | null,
  now: string,
): boolean {
  if (new Set(capHitDates).size < TRIAL_TRIGGER_STREAK_DAYS) return false
  if (!lastGrantedAt) return true
  const cooldownEnds = new Date(lastGrantedAt).getTime() + TRIAL_COOLDOWN_DAYS * 86_400_000
  return new Date(now).getTime() >= cooldownEnds
}

/** ISO timestamp `TRIAL_DURATION_DAYS` after `now` (ISO timestamp). */
export function trialExpiresAt(now: string): string {
  return new Date(new Date(now).getTime() + TRIAL_DURATION_DAYS * 86_400_000).toISOString()
}
