/* Placement probe rebuild (docs/placement-probe-rebuild.md) — the pure logic
 * half: word/letter difficulty scoring (§2), one-step staircase item
 * selection (§3), and turning a resolved probe into per-strand levels +
 * confidence (§5). No DB, no env access — matching gate.ts/frustration.ts's
 * pattern exactly, so this is unit-testable with no app runtime.
 *
 * What stays OUT of this module on purpose: the route (routes/placement.ts)
 * owns fetching the DB pools and turning a picked word/letter into an actual
 * ProbeQuestion (prompt copy, choices, audio); the shared client module
 * (@koodakbook/shared's probeFlow.ts) owns walking the resulting item bank
 * strand-by-strand as answers come in. This module never sees a ProbeQuestion
 * or an HTTP request — only bare content rows and booleans. */

import { priorWeight } from './gate'

// ── §2: difficulty scoring ───────────────────────────────────────────────

export interface LetterInfo {
  character: string
  group: number
  orderInGroup: number
}

/** A letter's own rank in the authored teach order (project.md: "grouped by
 *  shape similarity, not alphabetical order") — group is the coarse teach
 *  sequence, order_in_group breaks ties within a shape-similar cluster (e.g.
 *  ب/پ/ت/ث, distinguished only by dot count/placement). Higher = taught
 *  later / more visually confusable. */
export function letterRank(l: LetterInfo): number {
  return l.group * 100 + l.orderInGroup
}

export interface WordDifficultyInput {
  stage: number
  persian: string
}

/** A word's complexity from the letters it's built from: the HARDEST
 *  (highest-ranked) letter it contains, not the average — a word with even
 *  one late-taught or high-dot-ambiguity letter is only as easy as its
 *  hardest letter. 0 if none of its characters match a known letter (seed
 *  data gaps, or a letters list not covering every character in `persian`). */
export function wordLetterComplexity(persian: string, letters: LetterInfo[]): number {
  const byChar = new Map(letters.map(l => [l.character, letterRank(l)]))
  let max = 0
  for (const ch of persian) {
    const r = byChar.get(ch)
    if (r !== undefined && r > max) max = r
  }
  return max
}

// Weights are ordered by magnitude, not tuned by pilot data (A15) — the point
// is only that a lower axis can never outrank a higher one: one stage step
// dwarfs any letter-complexity difference, and one letter-complexity step
// dwarfs any length difference. Length alone decides nothing.
const STAGE_WEIGHT = 1_000_000
const COMPLEXITY_WEIGHT = 1_000

/** Composite difficulty (§2): stage (primary, curated teach-order — already
 *  the app's difficulty axis everywhere else) → letter-complexity (secondary,
 *  a Persian-specific signal word length can't see, since real content is
 *  written without harakat) → raw character length (tiebreaker only). */
export function wordDifficulty(word: WordDifficultyInput, letters: LetterInfo[]): number {
  return (
    word.stage * STAGE_WEIGHT +
    wordLetterComplexity(word.persian, letters) * COMPLEXITY_WEIGHT +
    word.persian.length
  )
}

// ── §3: one-step staircase item selection ────────────────────────────────

export interface StaircasePick<T> {
  mid: T | null
  hard: T | null
  easy: T | null
}

/** Pick up to 3 distinct items from `pool` — a middle-difficulty item plus a
 *  harder and an easier one — ranked by `score` (ascending = easier). A pool
 *  too small to represent a tier distinctly yields `null` for that tier
 *  rather than reusing another tier's item under a different label (the
 *  caller/scoring treats a null branch item as "this strand resolves after
 *  one item," exactly like the pre-rebuild single-item shape). */
export function pickStaircaseItems<T>(
  pool: T[],
  score: (item: T) => number,
  idOf: (item: T) => string,
): StaircasePick<T> {
  if (pool.length === 0) return { mid: null, hard: null, easy: null }
  const ranked = [...pool].sort((a, b) => score(a) - score(b))
  if (ranked.length === 1) return { mid: ranked[0], hard: null, easy: null }
  if (ranked.length === 2) {
    // Only two difficulty tiers exist — mid takes the easier one so whichever
    // branch fires is still a genuine step, and the harder one is the branch.
    return { mid: ranked[0], hard: ranked[1], easy: null }
  }
  const midIdx = Math.floor((ranked.length - 1) / 2)
  const mid = ranked[midIdx]
  const midId = idOf(mid)
  const remaining = ranked.filter(item => idOf(item) !== midId)
  return { mid, hard: remaining[remaining.length - 1] ?? null, easy: remaining[0] ?? null }
}

// ── §5: scoring a resolved probe into levels + confidence ────────────────

export interface StrandProbeOutcome {
  level: number
  /** Items actually resolved for this strand this probe — fed to gate.ts's
   *  w(n) as `n` (§5): a probe item is one real scored interaction, just far
   *  less of it than a lesson session. */
  nProbe: number
}

/** Score a V/D/F strand's up-to-2-item staircase result (§3):
 *    []              → strand skipped (no usable content)        → level 1
 *    [x]             → branch item unavailable, single-item shape → 2 or 1
 *    [mid, branch]   → both correct  → 3 · one of two → 2 · both miss → 1 */
export function scoreBranchStrand(results: boolean[]): StrandProbeOutcome {
  if (results.length === 0) return { level: 1, nProbe: 0 }
  if (results.length === 1) return { level: results[0] ? 2 : 1, nProbe: 1 }
  const [mid, branch] = results
  if (mid && branch) return { level: 3, nProbe: 2 }
  if (!mid && !branch) return { level: 1, nProbe: 2 }
  return { level: 2, nProbe: 2 }
}

/** C's single, unbranched item (§3 — unchanged in kind from the pre-rebuild
 *  probe): `null` means the strand was skipped (no usable content). */
export function scoreSingleStrand(result: boolean | null): StrandProbeOutcome {
  if (result === null) return { level: 1, nProbe: 0 }
  return { level: result ? 2 : 1, nProbe: 1 }
}

export interface ProbeResults {
  V: boolean[]
  D: boolean[]
  F: boolean[]
  C: boolean | null
}

export interface ProbeScore {
  /** Overall starting level (children.level), from the EARNABLE strands only
   *  (gate.ts's V/D/F) — C never feeds a recompute, so it stays out of the
   *  overall number the same way it stays out of every gate.ts average. */
  level: 1 | 2 | 3 | 4
  strands: { V: number; D: number; F: number; C: number }
  /** confidence = 1 - w(n_probe), the SAME w(n) = k/(k+n) gate.ts already
   *  uses for real evidence (§5) — no separate confidence signal invented. */
  confidence: { V: number; D: number; F: number; C: number }
}

function clampLevel(n: number): 1 | 2 | 3 | 4 {
  return Math.max(1, Math.min(4, Math.round(n))) as 1 | 2 | 3 | 4
}

export function scoreProbe(results: ProbeResults, k: number): ProbeScore {
  const v = scoreBranchStrand(results.V)
  const d = scoreBranchStrand(results.D)
  const f = scoreBranchStrand(results.F)
  const c = scoreSingleStrand(results.C)
  return {
    level: clampLevel((v.level + d.level + f.level) / 3),
    strands: { V: v.level, D: d.level, F: f.level, C: c.level },
    confidence: {
      V: 1 - priorWeight(v.nProbe, k),
      D: 1 - priorWeight(d.nProbe, k),
      F: 1 - priorWeight(f.nProbe, k),
      C: 1 - priorWeight(c.nProbe, k),
    },
  }
}

// ── §4/A13: item-count ceiling ────────────────────────────────────────────

/** Unvalidated (A13) — 2 items each for V/D/F plus 1 for C. Overridable via
 *  PLACEMENT_MAX_ITEMS; see placementBranchingEnabled below for what a lower
 *  value actually does. */
export const DEFAULT_PLACEMENT_MAX_ITEMS = 7

/** A budget below the full 7 falls back to ONE item per strand (the
 *  pre-rebuild shape) rather than silently truncating mid-staircase — an
 *  unadministered branch item would otherwise misscore as a miss, which is
 *  worse than not branching at all. */
export function placementBranchingEnabled(maxItems: number): boolean {
  return maxItems >= DEFAULT_PLACEMENT_MAX_ITEMS
}
