/* Gate recompute (gate.ts) — the placement/progression rebuild core. A mis-set
 * gate silently serves a child content that is too hard or too easy, with no
 * visible error, so these assert the INTENDED rules of the design
 * (docs/placement-progression-rebuild.md §5), not merely current output.
 *
 * Pure module — no DB — so it runs under `npm test` directly. Run: npm test */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  demonstratedLevel, priorWeight, targetGate, dampGate,
  recomputeGates, promotionsFrom,
  EARNABLE, MAX_LEVEL, DEFAULT_GATE_CONFIG,
  type GateContent, type GateConfig, type GateInput, type EarnableStrand,
} from './gate'

// ── fixtures ────────────────────────────────────────────────────────────────
const cfg = (o: Partial<GateConfig> = {}): GateConfig => ({ ...DEFAULT_GATE_CONFIG, ...o })
const vocab = (n: number, stage: number, tag = 'v') =>
  Array.from({ length: n }, (_, i) => ({ id: `${tag}${stage}_${i}`, type: 'vocabulary', stage }))
const storiesAt = (n: number, stage: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${stage}_${i}`, stage }))
const ids = (arr: { id: string }[]) => new Set(arr.map(x => x.id))
const emptyContent: GateContent = { lessons: [], stories: [], masteredLessons: new Set(), masteredStories: new Set() }
const lessonsContent = (lessons: GateContent['lessons'], masteredLessons: ReadonlySet<string>): GateContent =>
  ({ ...emptyContent, lessons, masteredLessons })
const storyContent = (stories: GateContent['stories'], masteredStories: ReadonlySet<string>): GateContent =>
  ({ ...emptyContent, stories, masteredStories })
// A per-strand input triple, defaulting to "fresh at this prior".
const input = (prior: number, previousGate: number | null = null, n = 0): GateInput => ({ prior, previousGate, n })
const inputs = (v: GateInput, d: GateInput, f: GateInput): Record<EarnableStrand, GateInput> => ({ V: v, D: d, F: f })
const gateOf = (rs: ReturnType<typeof recomputeGates>, s: EarnableStrand) => rs.find(r => r.strand === s)!.gateAfter

// ═══ demonstratedLevel: the evidence → level map ═══════════════════════════

test('demonstrated = 1 + contiguous mastered stages from the lowest', () => {
  const th = DEFAULT_GATE_CONFIG.masteryThreshold
  // only stage 2, all mastered → 1 + {2} = 2
  const only2 = vocab(20, 2)
  assert.equal(demonstratedLevel('V', lessonsContent(only2, ids(only2)), th), 2)
  // stages 2,3 mastered → 1 + {2,3} = 3
  const two3 = [...vocab(6, 2), ...vocab(6, 3)]
  assert.equal(demonstratedLevel('V', lessonsContent(two3, ids(two3)), th), 3)
  // stages 2..5 mastered → clamps at MAX_LEVEL
  const deep = [...vocab(4, 2), ...vocab(4, 3), ...vocab(4, 4), ...vocab(4, 5)]
  assert.equal(demonstratedLevel('V', lessonsContent(deep, ids(deep)), th), MAX_LEVEL)
})

test('the contiguous run halts at the first uncleared stage', () => {
  const th = DEFAULT_GATE_CONFIG.masteryThreshold
  const s2 = vocab(6, 2), s3 = vocab(6, 3)
  // stage 2 mastered, stage 3 NOT → stays at 2 (does not credit the higher stage)
  assert.equal(demonstratedLevel('V', lessonsContent([...s2, ...s3], ids(s2)), th), 2)
})

test('a stage is cleared at exactly ceil(threshold), not below', () => {
  const th = 0.85
  const s2 = vocab(20, 2)
  // 17/20 = ceil(0.85*20) → cleared → demonstrated 2
  assert.equal(demonstratedLevel('V', lessonsContent(s2, ids(s2.slice(0, 17))), th), 2)
  // 16/20 → not cleared → demonstrated 1
  assert.equal(demonstratedLevel('V', lessonsContent(s2, ids(s2.slice(0, 16))), th), 1)
})

test('no content for a strand → demonstrated floors at 1', () => {
  assert.equal(demonstratedLevel('V', emptyContent, 0.85), 1)
})

test('mastery ≠ completion: only mastered items count toward a stage (§6.1)', () => {
  // 20 items exist and are all "done", but only 10 are in the mastered set.
  // 10/20 < 85% → the stage is NOT cleared → demonstrated stays 1.
  const s2 = vocab(20, 2)
  const halfMastered = ids(s2.slice(0, 10))
  assert.equal(demonstratedLevel('V', lessonsContent(s2, halfMastered), 0.85), 1)
})

// ═══ F is decoupled from C (decision i) ════════════════════════════════════

test('demonstrated_F depends only on mastered stories — C is not an input at all', () => {
  const th = DEFAULT_GATE_CONFIG.masteryThreshold
  const st = [...storiesAt(4, 2), ...storiesAt(4, 3)]
  const content = storyContent(st, ids(st))
  // There is no C parameter to pass; F is computed purely from mastered stories.
  // Whatever a child's comprehension gate is, this number cannot change.
  assert.equal(demonstratedLevel('F', content, th), 3)
  // And via the full recompute, F's gate is driven by story mastery, not by any
  // V/D state around it.
  const rs = recomputeGates(inputs(input(1), input(1), input(1, null, 100)), content, cfg())
  assert.equal(gateOf(rs, 'F'), 3)
})

// ═══ Prior as a decaying prior (§3) ════════════════════════════════════════

test('priorWeight: 1 at n=0, decreasing, → 0 as n grows', () => {
  assert.equal(priorWeight(0, 8), 1)
  assert.equal(priorWeight(8, 8), 0.5)          // parity at n=k
  assert.ok(priorWeight(24, 8) < priorWeight(8, 8))
  assert.ok(priorWeight(1000, 8) < 0.01)
})

test('at n=0 the gate is the prior; at large n it is the demonstrated level', () => {
  const only2 = vocab(20, 2)
  const content = lessonsContent(only2, ids(only2)) // demonstrated_V = 2
  // Fresh (n=0): prior 4 dominates entirely → gate 4.
  assert.equal(targetGate(4, 2, 0, 8), 4)
  // Lots of evidence (n large): prior washes out → gate = demonstrated 2.
  assert.equal(targetGate(4, 2, 1000, 8), 2)
  // Sanity through the full recompute.
  assert.equal(gateOf(recomputeGates(inputs(input(4), input(1), input(1)), content, cfg()), 'V'), 4)
  assert.equal(gateOf(recomputeGates(inputs(input(4, null, 1000), input(1), input(1)), content, cfg()), 'V'), 2)
})

// ═══ BUG-C: idempotence — unchanged evidence never inflates the gate ═══════
// This is the pinned todo from promotion.test.ts, now a PASSING assertion.

test('BUG-C fixed: re-running on unchanged mastered content does not inflate the gate', () => {
  const only2 = vocab(20, 2)            // only stage 2 exists, all mastered
  const content = lessonsContent(only2, ids(only2))
  const config = cfg()
  // First recompute from a modest prior with real evidence settles V at 2.
  const first = recomputeGates(inputs(input(2, 1, 40), input(1), input(1)), content, config)
  assert.equal(gateOf(first, 'V'), 2)
  // Feed the result back as previousGate and run again with the SAME evidence:
  // it must not climb. The old model walked 2→3→4 here.
  let prev = gateOf(first, 'V')
  for (let i = 0; i < 5; i++) {
    const again = recomputeGates(inputs(input(2, prev, 40), input(1), input(1)), content, config)
    assert.equal(gateOf(again, 'V'), 2, 'settled strand must not inflate')
    assert.deepEqual(promotionsFrom(again), [], 'no phantom unlock events on unchanged evidence')
    prev = gateOf(again, 'V')
  }
})

// ═══ Bidirectional movement (decision ii) ══════════════════════════════════

test('stronger evidence raises the gate', () => {
  const config = cfg()
  const s2 = vocab(6, 2)
  const before = recomputeGates(inputs(input(1, 1, 20), input(1), input(1)), lessonsContent(s2, new Set()), config)
  assert.equal(gateOf(before, 'V'), 1)
  // Now the child masters stage 2 and 3 → gate rises.
  const s23 = [...vocab(6, 2), ...vocab(6, 3)]
  const after = recomputeGates(inputs(input(1, 1, 20), input(1), input(1)), lessonsContent(s23, ids(s23)), config)
  assert.ok(gateOf(after, 'V') > 1, 'gate rose with demonstrated mastery')
})

test('weaker-than-placement evidence lowers the gate (not a one-way ratchet)', () => {
  // Over-placed prior 4, but the child only demonstrates stage 2 → gate must fall.
  const only2 = vocab(20, 2)
  const content = lessonsContent(only2, ids(only2))
  const config = cfg({ maxDownPerRecompute: 4 }) // allow the full drop in one step for this assertion
  const rs = recomputeGates(inputs(input(4, 4, 100), input(1), input(1)), content, config)
  assert.ok(gateOf(rs, 'V') < 4, 'gate moved down toward demonstrated ability')
  assert.equal(gateOf(rs, 'V'), 2)
})

// ═══ Asymmetric damping (decision 6.4) ═════════════════════════════════════

test('a downward move is capped per recompute; upward is not', () => {
  // target 1, previous 4, cap 1 → only steps down to 3, flagged damped.
  assert.deepEqual(dampGate(4, 1, 1), { gate: 3, damped: true })
  // upward is unrestricted.
  assert.deepEqual(dampGate(1, 4, 1), { gate: 4, damped: false })
  // first ever (no previous) lands on target, undamped.
  assert.deepEqual(dampGate(null, 4, 1), { gate: 4, damped: false })
})

test('toy over-placement self-corrects downward over successive recomputes and settles', () => {
  // 4-item probe pinned prior=4; child truly demonstrates only stage 2. With the
  // damping cap the gate slides 4→3→2 across sessions, then holds at 2.
  const only2 = vocab(20, 2)
  const content = lessonsContent(only2, ids(only2))
  const config = cfg({ maxDownPerRecompute: 1 })
  const seen: number[] = []
  let prev: number | null = 4
  for (let i = 0; i < 6; i++) {
    const rs = recomputeGates(inputs(input(4, prev, 100), input(1), input(1)), content, config)
    prev = gateOf(rs, 'V')
    seen.push(prev)
  }
  assert.deepEqual(seen, [3, 2, 2, 2, 2, 2], 'monotone descent to demonstrated, then a fixed point')
})

// ═══ Bounds, earnable set, and the promotions contract ═════════════════════

test('the gate is clamped to [1, MAX_LEVEL]', () => {
  const deep = [...vocab(4, 2), ...vocab(4, 3), ...vocab(4, 4), ...vocab(4, 5), ...vocab(4, 6)]
  const content = lessonsContent(deep, ids(deep))
  const rs = recomputeGates(inputs(input(4, 4, 1000), input(1), input(1)), content, cfg())
  assert.ok(gateOf(rs, 'V') <= MAX_LEVEL && gateOf(rs, 'V') >= 1)
  assert.equal(gateOf(rs, 'V'), MAX_LEVEL)
})

test('only V, D, F are earnable — recompute never touches P or C', () => {
  const rs = recomputeGates(inputs(input(1), input(1), input(1)), emptyContent, cfg())
  assert.deepEqual(rs.map(r => r.strand).sort(), [...EARNABLE].sort())
  assert.equal(rs.some(r => (r.strand as string) === 'P' || (r.strand as string) === 'C'), false)
})

test('promotions are upward-only content-unlock events; downward moves are silent', () => {
  const results = [
    { strand: 'V' as const, prior: 1, demonstrated: 3, n: 50, w: 0.1, k: 8, gateBefore: 1, gateAfter: 3, damped: false },
    { strand: 'D' as const, prior: 4, demonstrated: 2, n: 50, w: 0.1, k: 8, gateBefore: 4, gateAfter: 3, damped: true },
    { strand: 'F' as const, prior: 1, demonstrated: 1, n: 0, w: 1, k: 8, gateBefore: null, gateAfter: 1, damped: false },
  ]
  // V rose 1→3 (emit); D fell 4→3 (silent); F is first-ever (no baseline, silent).
  assert.deepEqual(promotionsFrom(results), [{ strand: 'V', from: 1, to: 3 }])
})

// ═══ Migration determinism (§4) ════════════════════════════════════════════

test('migration is deterministic: correctly-leveled child unchanged, ratcheted child corrected down', () => {
  const only2 = vocab(20, 2)
  const content = lessonsContent(only2, ids(only2)) // demonstrated_V = 2
  const config = cfg({ maxDownPerRecompute: MAX_LEVEL }) // migration may correct fully
  // (a) A child correctly at 2 with a matching prior: recompute is a no-op.
  const ok = recomputeGates(inputs(input(2, 2, 60), input(1, 1, 0), input(1, 1, 0)), content, config)
  assert.equal(gateOf(ok, 'V'), 2)
  assert.deepEqual(promotionsFrom(ok), [])
  // (b) A child ratcheted to 4 on the same thin content: corrected down to 2,
  //     silently (no promotion emitted for a downward move). Deterministic.
  const ratcheted = recomputeGates(inputs(input(2, 4, 60), input(1, 1, 0), input(1, 1, 0)), content, config)
  assert.equal(gateOf(ratcheted, 'V'), 2)
  assert.deepEqual(promotionsFrom(ratcheted), [])
})
