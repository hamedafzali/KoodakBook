/* Re-placement scheduling (reprobe.ts) — docs/re-placement-flow-design.md §1.
 * Pure module — no DB, no clock access — so it runs under `npm test` directly.
 * Run: npm test */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  reprobeIntervalDays, isReprobeDue, nextEligibleAt,
  DEFAULT_REPROBE_CONFIG, type ReprobeConfig,
} from './reprobe'

const DAY_MS = 24 * 60 * 60 * 1000
const cfg = (o: Partial<ReprobeConfig> = {}): ReprobeConfig => ({ ...DEFAULT_REPROBE_CONFIG, ...o })
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)

// ═══ reprobeIntervalDays: deterministic per-child jitter ═══════════════════

test('interval is deterministic — same child id always yields the same interval', () => {
  const a = reprobeIntervalDays('child-abc', cfg())
  const b = reprobeIntervalDays('child-abc', cfg())
  assert.equal(a, b)
})

test('interval stays within [base - jitter, base + jitter] for many ids', () => {
  const c = cfg({ intervalDays: 63, jitterDays: 14 })
  for (const id of ['a', 'b', 'c', 'child-1', 'child-2', '11111111-1111-1111-1111-111111111111', 'zzzz']) {
    const days = reprobeIntervalDays(id, c)
    assert.ok(days >= 63 - 14 && days <= 63 + 14, `${id} -> ${days}`)
  }
})

test('different child ids can yield different intervals (jitter actually spreads them)', () => {
  const c = cfg({ intervalDays: 63, jitterDays: 14 })
  const values = new Set(
    Array.from({ length: 20 }, (_, i) => reprobeIntervalDays(`child-${i}`, c)),
  )
  assert.ok(values.size > 1, 'expected jitter to produce more than one distinct interval')
})

test('zero jitter collapses to exactly the base interval for every child', () => {
  const c = cfg({ intervalDays: 63, jitterDays: 0 })
  assert.equal(reprobeIntervalDays('any-child', c), 63)
  assert.equal(reprobeIntervalDays('another-child', c), 63)
})

test('interval never drops below 1 day even with jitter larger than the base', () => {
  const c = cfg({ intervalDays: 2, jitterDays: 30 })
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    assert.ok(reprobeIntervalDays(id, c) >= 1)
  }
})

// ═══ isReprobeDue ═══════════════════════════════════════════════════════════

test('not due immediately after placement', () => {
  assert.equal(isReprobeDue(daysAgo(0), new Date(), 'child-x', cfg({ intervalDays: 63, jitterDays: 0 })), false)
})

test('not due just before the interval elapses', () => {
  assert.equal(isReprobeDue(daysAgo(62), new Date(), 'child-x', cfg({ intervalDays: 63, jitterDays: 0 })), false)
})

test('due once the interval has elapsed', () => {
  assert.equal(isReprobeDue(daysAgo(63), new Date(), 'child-x', cfg({ intervalDays: 63, jitterDays: 0 })), true)
})

test('stays due well past the interval — no expiry, no urgency window', () => {
  assert.equal(isReprobeDue(daysAgo(200), new Date(), 'child-x', cfg({ intervalDays: 63, jitterDays: 0 })), true)
})

test('two children placed the same day can become due on different days (jitter)', () => {
  const c = cfg({ intervalDays: 63, jitterDays: 14 })
  const placedAt = daysAgo(63) // exactly the base interval
  const results = ['child-1', 'child-2', 'child-3', 'child-4', 'child-10'].map(id => isReprobeDue(placedAt, new Date(), id, c))
  // Not all identical — some have a positive jitter offset (not yet due at
  // exactly 63 days), some negative (already due). If this ever flakes because
  // a particular fixture set of ids all hash the same way, that's a real
  // finding about hashUnit's distribution, not a bad test.
  assert.ok(new Set(results).size === 2, 'expected the jitter to split this fixed set of ids across due/not-due at exactly the base interval')
})

// ═══ nextEligibleAt ═════════════════════════════════════════════════════════

test('nextEligibleAt is exactly placedAt + this child\'s jittered interval', () => {
  const c = cfg({ intervalDays: 63, jitterDays: 0 })
  const placedAt = new Date('2026-01-01T00:00:00.000Z')
  const next = nextEligibleAt(placedAt, 'child-x', c)
  assert.equal(next.getTime(), placedAt.getTime() + 63 * DAY_MS)
})

test('isReprobeDue and nextEligibleAt agree at the boundary', () => {
  const c = cfg({ intervalDays: 63, jitterDays: 14 })
  const placedAt = new Date('2026-01-01T00:00:00.000Z')
  const boundary = nextEligibleAt(placedAt, 'child-y', c)
  assert.equal(isReprobeDue(placedAt, boundary, 'child-y', c), true)
  assert.equal(isReprobeDue(placedAt, new Date(boundary.getTime() - 1), 'child-y', c), false)
})
