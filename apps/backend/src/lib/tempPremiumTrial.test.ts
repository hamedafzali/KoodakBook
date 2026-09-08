import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrialEligible, trialExpiresAt, TRIAL_DURATION_DAYS } from './tempPremiumTrial'

test('fewer than 3 distinct cap-hit days is not eligible', () => {
  assert.equal(isTrialEligible(['2026-09-01', '2026-09-02'], null, '2026-09-02T00:00:00Z'), false)
})

test('3 distinct cap-hit days with no prior grant is eligible', () => {
  assert.equal(
    isTrialEligible(['2026-09-01', '2026-09-02', '2026-09-03'], null, '2026-09-03T00:00:00Z'),
    true,
  )
})

test('duplicate hits on the same day do not count twice toward the streak', () => {
  assert.equal(
    isTrialEligible(['2026-09-01', '2026-09-01', '2026-09-02'], null, '2026-09-02T00:00:00Z'),
    false,
  )
})

test('a recent grant blocks re-granting inside the cooldown', () => {
  assert.equal(
    isTrialEligible(
      ['2026-09-01', '2026-09-02', '2026-09-03'],
      '2026-08-15T00:00:00Z', // 25 days before now — inside 90-day cooldown
      '2026-09-09T00:00:00Z',
    ),
    false,
  )
})

test('a grant older than the cooldown window is eligible again', () => {
  assert.equal(
    isTrialEligible(
      ['2026-09-01', '2026-09-02', '2026-09-03'],
      '2026-06-01T00:00:00Z', // well over 90 days before now
      '2026-09-09T00:00:00Z',
    ),
    true,
  )
})

test('eligibility is exact at the cooldown boundary', () => {
  const lastGrantedAt = '2026-01-01T00:00:00.000Z'
  const now = new Date(new Date(lastGrantedAt).getTime() + 90 * 86_400_000).toISOString()
  assert.equal(isTrialEligible(['2026-09-01', '2026-09-02', '2026-09-03'], lastGrantedAt, now), true)
})

test('trialExpiresAt adds the trial duration to now', () => {
  const now = '2026-09-09T12:00:00.000Z'
  const expected = new Date(new Date(now).getTime() + TRIAL_DURATION_DAYS * 86_400_000).toISOString()
  assert.equal(trialExpiresAt(now), expected)
})
