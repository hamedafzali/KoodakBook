/* Placement probe rebuild (probe.ts) — difficulty scoring, staircase item
 * selection, and scoring a resolved probe into levels + confidence. This
 * supersedes the old placement.test.ts, which characterised scorePlacement's
 * leading-streak/binary-strand mapping — that function and its "every strand
 * caps at 2" behaviour are gone; this file asserts the INTENDED rules of
 * docs/placement-probe-rebuild.md §2/§3/§5 instead of merely current output.
 *
 * Pure module — no DB — so it runs under `npm test` directly. Run: npm test */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  letterRank, wordLetterComplexity, wordDifficulty,
  pickStaircaseItems, scoreBranchStrand, scoreSingleStrand, scoreProbe,
  placementBranchingEnabled, DEFAULT_PLACEMENT_MAX_ITEMS,
  type LetterInfo,
} from './probe'
import { DEFAULT_PRIOR_K } from './gate'

// ── §2: letter rank / word complexity ───────────────────────────────────────

const letters: LetterInfo[] = [
  { character: 'ا', group: 1, orderInGroup: 1 },
  { character: 'ب', group: 2, orderInGroup: 1 },
  { character: 'پ', group: 2, orderInGroup: 2 },
  { character: 'ث', group: 2, orderInGroup: 4 },
  { character: 'گ', group: 8, orderInGroup: 2 },
]

test('letterRank orders by group first, order_in_group second', () => {
  const ranks = letters.map(letterRank)
  assert.ok(ranks[0] < ranks[1])              // ا (group 1) < ب (group 2)
  assert.ok(ranks[1] < ranks[2])              // ب (2,1) < پ (2,2)
  assert.ok(ranks[2] < ranks[3])              // پ (2,2) < ث (2,4)
  assert.ok(ranks[3] < ranks[4])              // ث (group 2) < گ (group 8)
})

test('wordLetterComplexity is the HARDEST letter in the word, not the average', () => {
  // 'اث' pairs an early letter (ا) with a late-group one (ث) — complexity
  // must track ث, not average toward ا.
  const soleHard = wordLetterComplexity('اث', letters)
  const soleEasy = wordLetterComplexity('اا', letters)
  assert.ok(soleHard > soleEasy)
  assert.equal(soleHard, letterRank(letters[3]))
})

test('wordLetterComplexity is 0 when no character matches a known letter', () => {
  assert.equal(wordLetterComplexity('xyz', letters), 0)
})

// ── §2: composite difficulty — stage dominates letters dominates length ────

test('a higher stage always outranks letter-complexity and length, however extreme', () => {
  const stage1LongHardLetters = wordDifficulty({ stage: 1, persian: 'ثثثثثثثثثث' }, letters)
  const stage2ShortEasyLetters = wordDifficulty({ stage: 2, persian: 'اا' }, letters)
  assert.ok(stage2ShortEasyLetters > stage1LongHardLetters)
})

test('within the same stage, letter-complexity outranks length', () => {
  const sameStageHardLetters = wordDifficulty({ stage: 1, persian: 'ث' }, letters)
  const sameStageLongEasyLetters = wordDifficulty({ stage: 1, persian: 'اااااااااا' }, letters)
  assert.ok(sameStageHardLetters > sameStageLongEasyLetters)
})

test('length only breaks ties within the same stage and letter-complexity', () => {
  const short = wordDifficulty({ stage: 1, persian: 'اب' }, letters)
  const long = wordDifficulty({ stage: 1, persian: 'اباب' }, letters)
  assert.ok(long > short)
})

// ── §3: staircase item selection ────────────────────────────────────────────

interface Scored { id: string; score: number }
const w = (id: string, score: number): Scored => ({ id, score })
const byScore = (x: Scored) => x.score
const byId = (x: Scored) => x.id

test('an empty pool yields no items at all', () => {
  assert.deepEqual(pickStaircaseItems<Scored>([], byScore, byId), { mid: null, hard: null, easy: null })
})

test('a pool of 1 yields only mid — no branch possible', () => {
  const picks = pickStaircaseItems([w('a', 1)], byScore, byId)
  assert.equal(picks.mid?.id, 'a')
  assert.equal(picks.hard, null)
  assert.equal(picks.easy, null)
})

test('a pool of 2 yields mid (the easier) and hard (the harder), no distinct easy', () => {
  const picks = pickStaircaseItems([w('hard', 5), w('easy', 1)], byScore, byId)
  assert.equal(picks.mid?.id, 'easy')
  assert.equal(picks.hard?.id, 'hard')
  assert.equal(picks.easy, null)
})

test('a pool of 3+ yields three distinct items: easy < mid < hard', () => {
  const pool = [w('c', 3), w('a', 1), w('e', 5), w('b', 2), w('d', 4)]
  const picks = pickStaircaseItems(pool, byScore, byId)
  const ids = [picks.easy?.id, picks.mid?.id, picks.hard?.id]
  assert.equal(new Set(ids).size, 3, 'all three tiers are distinct items')
  assert.ok(picks.easy!.score < picks.mid!.score)
  assert.ok(picks.mid!.score < picks.hard!.score)
})

// ── §5: scoring a strand's resolved staircase ───────────────────────────────

test('scoreBranchStrand: no items resolved → level 1, n=0 (strand skipped)', () => {
  assert.deepEqual(scoreBranchStrand([]), { level: 1, nProbe: 0 })
})

test('scoreBranchStrand: only the mid item resolved (no branch content) → binary 2/1, n=1', () => {
  assert.deepEqual(scoreBranchStrand([true]), { level: 2, nProbe: 1 })
  assert.deepEqual(scoreBranchStrand([false]), { level: 1, nProbe: 1 })
})

test('scoreBranchStrand: full 2x2 branch outcome matrix, n=2', () => {
  assert.deepEqual(scoreBranchStrand([true, true]), { level: 3, nProbe: 2 })   // mid + hard both correct
  assert.deepEqual(scoreBranchStrand([true, false]), { level: 2, nProbe: 2 })  // mid correct, hard missed
  assert.deepEqual(scoreBranchStrand([false, true]), { level: 2, nProbe: 2 })  // mid missed, easy correct
  assert.deepEqual(scoreBranchStrand([false, false]), { level: 1, nProbe: 2 }) // both missed
})

test('scoreSingleStrand (C): unbranched — null means skipped, else binary 2/1', () => {
  assert.deepEqual(scoreSingleStrand(null), { level: 1, nProbe: 0 })
  assert.deepEqual(scoreSingleStrand(true), { level: 2, nProbe: 1 })
  assert.deepEqual(scoreSingleStrand(false), { level: 1, nProbe: 1 })
})

// ── §5: full probe scoring — level, strands, confidence ─────────────────────

test('a fully-skipped probe (no content anywhere) → level 1, every strand 1, zero confidence', () => {
  const score = scoreProbe({ V: [], D: [], F: [], C: null }, DEFAULT_PRIOR_K)
  assert.deepEqual(score.strands, { V: 1, D: 1, F: 1, C: 1 })
  assert.deepEqual(score.confidence, { V: 0, D: 0, F: 0, C: 0 })
  assert.equal(score.level, 1)
})

test('overall level averages only the EARNABLE strands (V/D/F) — C never counts', () => {
  // All V/D/F miss both items (level 1 each) but C aces its item (level 2) —
  // overall level must stay 1, not be pulled up by C.
  const score = scoreProbe({ V: [false, false], D: [false, false], F: [false, false], C: true }, DEFAULT_PRIOR_K)
  assert.equal(score.level, 1)
  assert.equal(score.strands.C, 2)
})

test('confidence matches the design doc §5 worked example at k=8', () => {
  const score = scoreProbe({ V: [], D: [true], F: [true, true], C: true }, 8)
  assert.equal(score.confidence.V, 0)                              // n=0 → w=1.00 → conf 0.00
  assert.ok(Math.abs(score.confidence.D - 0.11) < 0.005)           // n=1 → w=8/9   → conf ≈0.11
  assert.ok(Math.abs(score.confidence.F - 0.20) < 0.005)           // n=2 → w=8/10  → conf ≈0.20
  assert.ok(Math.abs(score.confidence.C - 0.11) < 0.005)           // C's single item, same formula
})

test('a full 2-item staircase earns roughly double the confidence of a 1-item probe (§5)', () => {
  const oneItem = scoreProbe({ V: [true], D: [], F: [], C: null }, DEFAULT_PRIOR_K)
  const twoItem = scoreProbe({ V: [true, true], D: [], F: [], C: null }, DEFAULT_PRIOR_K)
  assert.ok(twoItem.confidence.V > oneItem.confidence.V)
  assert.ok(twoItem.confidence.V < 2 * oneItem.confidence.V + 0.01) // "roughly double," not more
})

// ── A13: item-budget fallback ────────────────────────────────────────────────

test('placementBranchingEnabled requires the full budget; anything less falls back to 1 item/strand', () => {
  assert.equal(placementBranchingEnabled(DEFAULT_PLACEMENT_MAX_ITEMS), true)
  assert.equal(placementBranchingEnabled(4), false)
  assert.equal(placementBranchingEnabled(10), true)
})
