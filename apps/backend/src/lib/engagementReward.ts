/* Free→temp-premium REWARD: a growth mechanic, not a gating rule — and a
 * deliberately different trigger from lib/tempPremiumTrial.ts's "you keep
 * hitting your limit" nudge.
 *
 * Per the product owner (2026-09-17): "similar to Duolingo, time to time we
 * open premium for example 2 days for free plans if they work more — but
 * not in [a] short period, just for marketing." This is a carrot for real
 * engagement (a streak), not a response to frustration (a cap hit) — same
 * plan-grant mechanism as the existing trial (users.plan / plan_expires_at,
 * temp_premium_grants as the audit trail), different reason, different
 * numbers, no new migration/table needed.
 *
 * Cooldown is checked the SAME way routes/ai.ts already checks it for the
 * frustration-trial: the account's most recent temp_premium_grants row,
 * REGARDLESS of reason. That's deliberate, not an oversight — it stops the
 * two mechanics from being alternated to keep a free account effectively on
 * permanent premium (hit the cap → get 5 days; streak reward fires the
 * moment that lapses → get 2 more days; repeat). One shared "last grant"
 * clock across both reasons keeps a free account genuinely free most of the
 * time, which is the whole point of a reward that's "just for marketing."
 */

export const REWARD_TRIGGER_STREAK_DAYS = 5
export const REWARD_DURATION_DAYS = 2
export const REWARD_COOLDOWN_DAYS = 60
export const REWARD_PLAN_KEY = 'premium_solo'

/**
 * `streakDays`: this child's current streak (dashboard.ts's own
 * `computeStreak` result — the same number already shown to the parent, not
 * a new metric). `lastGrantedAt`: ISO timestamp of this account's most
 * recent temp-premium grant of ANY reason, or null if it's never had one.
 * `now`: ISO timestamp.
 */
export function isRewardEligible(
  streakDays: number,
  lastGrantedAt: string | null,
  now: string,
): boolean {
  if (streakDays < REWARD_TRIGGER_STREAK_DAYS) return false
  if (!lastGrantedAt) return true
  const cooldownEnds = new Date(lastGrantedAt).getTime() + REWARD_COOLDOWN_DAYS * 86_400_000
  return new Date(now).getTime() >= cooldownEnds
}

/** ISO timestamp `REWARD_DURATION_DAYS` after `now` (ISO timestamp). */
export function rewardExpiresAt(now: string): string {
  return new Date(new Date(now).getTime() + REWARD_DURATION_DAYS * 86_400_000).toISOString()
}
