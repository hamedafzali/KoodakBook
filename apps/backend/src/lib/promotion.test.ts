/* Strand promotion (computePromotionLevels) — raises a child's per-strand level
 * as they clear the unlocked content (§11.1). A mis-promotion silently mis-levels
 * the child (content too hard or too easy) with no visible error, so these assert
 * the intended rule, not merely the current output.
 *
 * Pure module (promotion.ts) — no DB — so it runs under `npm test` directly.
 * Run: npm test */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePromotionLevels, type PromotionContent } from './promotion'
import type { StrandLevels } from '@koodakbook/shared'

const LV = (o: Partial<StrandLevels> = {}): StrandLevels => ({ P: 1, D: 1, V: 1, F: 1, C: 1, ...o })
const vocab = (n: number, stage: number, tag = 'v') =>
  Array.from({ length: n }, (_, i) => ({ id: `${tag}${stage}_${i}`, type: 'vocabulary', stage }))
const storiesAt = (n: number, stage: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${stage}_${i}`, stage }))
const ids = (arr: { id: string }[]) => new Set(arr.map(x => x.id))
const empty: PromotionContent = { lessons: [], stories: [], doneLessons: new Set(), doneStories: new Set() }

// ── The 85% threshold, exactly (ceil(0.85 × unlocked)) ──────────────────────

test('promotes at exactly ceil(85%) done, not below', () => {
  const lessons = vocab(20, 2) // all unlocked at V=1 (stage-1 == V level 1 → stage ≤ 2)
  // 17/20 = ceil(0.85*20) → promote
  const at = computePromotionLevels(LV(), { ...empty, lessons, doneLessons: ids(lessons.slice(0, 17)) })
  assert.equal(at.levels.V, 2)
  assert.deepEqual(at.promotions, [{ strand: 'V', from: 1, to: 2 }])
  // 16/20 = one short of the ceil threshold → stay
  const below = computePromotionLevels(LV(), { ...empty, lessons, doneLessons: ids(lessons.slice(0, 16)) })
  assert.equal(below.levels.V, 1)
  assert.deepEqual(below.promotions, [])
})

// ── Level 4 is the ceiling ──────────────────────────────────────────────────

test('a strand climbs no higher than level 4 even with deeper completed content', () => {
  // Content at stages 2..5, all done — each promotion unlocks the next stage,
  // so it climbs, but the while-cap stops it at 4.
  const lessons = [...vocab(5, 2), ...vocab(5, 3), ...vocab(5, 4), ...vocab(5, 5)]
  const r = computePromotionLevels(LV(), { ...empty, lessons, doneLessons: ids(lessons) })
  assert.equal(r.levels.V, 4)
  assert.deepEqual(r.promotions, [{ strand: 'V', from: 1, to: 4 }])
})

test('a strand already at the cap is not promoted again (nothing to earn)', () => {
  const lessons = [...vocab(5, 4), ...vocab(5, 5)]
  const r = computePromotionLevels(LV({ V: 4 }), { ...empty, lessons, doneLessons: ids(lessons) })
  assert.equal(r.levels.V, 4)
  assert.deepEqual(r.promotions, [])
})

// ── P and C are never earnable (placement-only) ─────────────────────────────

test('P and C are never promoted, however much content is cleared', () => {
  // Fully-cleared vocab + stories that would drive V and F upward.
  const lessons = vocab(20, 2)
  const stories = storiesAt(20, 3)
  const r = computePromotionLevels(LV({ C: 1 }), {
    lessons, stories, doneLessons: ids(lessons), doneStories: ids(stories),
  })
  assert.equal(r.levels.C, 1, 'C stays at its placement level')
  assert.equal(r.levels.P, 1, 'P stays at its placement level')
  assert.equal(r.promotions.some(p => p.strand === 'C' || p.strand === 'P'), false)
  assert.ok(r.levels.V > 1, 'sanity: an earnable strand did move')
})

// ── The F↔C entanglement (story unlock = max(F,C)) ─────────────────────────

test('F cannot climb past what C already unlocks — it promotes once then halts', () => {
  // C=3 already unlocks stories up to stage 5 (max(F,C) ≥ stage-2). Bumping F
  // does not change max(F,C)=3, so the convergence guard halts F after one step.
  const stories = [...storiesAt(4, 3), ...storiesAt(4, 4), ...storiesAt(4, 5)]
  const r = computePromotionLevels(LV({ F: 1, C: 3 }), { ...empty, stories, doneStories: ids(stories) })
  assert.equal(r.levels.F, 2, 'F rises exactly one level despite all stories cleared')
  assert.deepEqual(r.promotions, [{ strand: 'F', from: 1, to: 2 }])
})

// ── Multi-level jump within a single call is allowed while content grows ────

test('a single call may jump several levels when each stage adds cleared content', () => {
  // Content at stages 2 and 3, all done. V=1 → unlock s2 (done) → 2 → unlock s3
  // (done) → 3 → stage 4 empty, halts. Two levels in one call.
  const lessons = [...vocab(6, 2), ...vocab(6, 3)]
  const r = computePromotionLevels(LV(), { ...empty, lessons, doneLessons: ids(lessons) })
  assert.equal(r.levels.V, 3)
  assert.deepEqual(r.promotions, [{ strand: 'V', from: 1, to: 3 }])
})

test('no content unlocked for a strand → no promotion', () => {
  const r = computePromotionLevels(LV(), empty)
  assert.deepEqual(r.promotions, [])
  assert.equal(r.levels.V, 1)
})

// ── BUG-C: promotion must SETTLE across repeated calls, not ratchet to the cap ─
// The docstring promises thin content "settles at cleared everything available
// instead of 4". It does within one call, but promoteStrands runs on EVERY
// completion, and re-running from the just-promoted level climbs another step
// (stage-2 content stays unlocked+done at every level), so V walks 1→2→3→4 over
// successive completions with no new content. This test pins the INTENDED
// behaviour (a settled strand does not move); it currently fails → marked todo
// so it documents the bug without breaking the suite. Remove todo when fixed.
test('re-running with the same cleared content does not keep inflating the level', { todo: 'BUG-C: ratchets to cap across calls' }, () => {
  const lessons = vocab(20, 2) // only stage 2 exists
  const content: PromotionContent = { ...empty, lessons, doneLessons: ids(lessons) }
  // First completion settles V at 2 (one step, guard halts — no stage-3 content).
  const first = computePromotionLevels(LV(), content)
  assert.equal(first.levels.V, 2)
  // A later completion with NO new content should be a no-op — the child has
  // cleared everything available and there is nothing new to earn.
  const again = computePromotionLevels(first.levels, content)
  assert.deepEqual(again.promotions, [], 'a settled strand must not promote again')
  assert.equal(again.levels.V, 2)
})
