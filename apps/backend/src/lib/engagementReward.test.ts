import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRewardEligible, rewardExpiresAt, REWARD_DURATION_DAYS } from './engagementReward'

test('a streak below the threshold is not eligible', () => {
  assert.equal(isRewardEligible(4, null, '2026-09-09T00:00:00Z'), false)
})

test('a streak at the threshold with no prior grant is eligible', () => {
  assert.equal(isRewardEligible(5, null, '2026-09-09T00:00:00Z'), true)
})

test('a longer streak than the threshold is still eligible', () => {
  assert.equal(isRewardEligible(30, null, '2026-09-09T00:00:00Z'), true)
})

test('a recent grant blocks re-granting inside the cooldown', () => {
  assert.equal(
    isRewardEligible(7, '2026-08-15T00:00:00Z', '2026-09-09T00:00:00Z'), // 25 days before now — inside 60-day cooldown
    false,
  )
})

test('a grant older than the cooldown window is eligible again', () => {
  assert.equal(
    isRewardEligible(7, '2026-06-01T00:00:00Z', '2026-09-09T00:00:00Z'), // well over 60 days before now
    true,
  )
})

test('eligibility is exact at the cooldown boundary', () => {
  const lastGrantedAt = '2026-01-01T00:00:00.000Z'
  const now = new Date(new Date(lastGrantedAt).getTime() + 60 * 86_400_000).toISOString()
  assert.equal(isRewardEligible(7, lastGrantedAt, now), true)
})

test('the cooldown check applies regardless of which mechanic granted last — the streak reward and the frustration trial share one clock', () => {
  // Same shape as a frustration-trial grant (routes/ai.ts): reason isn't part
  // of the signature at all, only the timestamp, which is the point.
  assert.equal(
    isRewardEligible(10, '2026-09-01T00:00:00Z', '2026-09-09T00:00:00Z'), // 8 days ago — inside 60-day cooldown
    false,
  )
})

test('rewardExpiresAt adds the reward duration to now', () => {
  const now = '2026-09-09T12:00:00.000Z'
  const expected = new Date(new Date(now).getTime() + REWARD_DURATION_DAYS * 86_400_000).toISOString()
  assert.equal(rewardExpiresAt(now), expected)
})
