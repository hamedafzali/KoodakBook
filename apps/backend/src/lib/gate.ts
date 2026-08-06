import { lessonStrand, type Promotion } from '@koodakbook/shared'

/* Pure gate recompute (docs/placement-progression-rebuild.md) — no DB, no imports
 * beyond the shared strand helper, so it is unit-testable without a database
 * (gate.test.ts). strands.ts does the DB fetch/persist and delegates here.
 *
 * Replaces the old increment-from-current-level promotion (promotion.ts), which
 * ratcheted a strand to the cap across repeated calls (BUG-C): re-entering at the
 * just-promoted level always found the same all-mastered content ≥85% cleared and
 * stepped up again. Here the gate is a deterministic FUNCTION OF EVIDENCE, so
 * recomputing on unchanged evidence yields the same value — the ratchet cannot
 * occur — and the gate is free to move DOWN as readily as up (decision ii). */

// Strands that gate content and can be earned by mastering it. P and C are
// placement-only (never earned) and so are absent here.
export const EARNABLE = ['V', 'D', 'F'] as const
export type EarnableStrand = typeof EARNABLE[number]
export const MIN_LEVEL = 1
export const MAX_LEVEL = 4

// Provisional defaults — every one is an UNVALIDATED assumption (design §7) that
// the caller overrides from runtime config so it can be tuned in a pilot without
// a release. Never bake these into a decision.
export const DEFAULT_PRIOR_K = 8               // prior/evidence parity at n≈k
export const DEFAULT_MASTERY_THRESHOLD = 0.85  // fraction mastered to clear a stage
export const DEFAULT_MAX_DOWN_PER_RECOMPUTE = 1 // asymmetric damping (decision 6.4)

export interface GateContent {
  lessons: { id: string; type: string; stage: number }[]
  stories: { id: string; stage: number }[]
  masteredLessons: ReadonlySet<string>
  masteredStories: ReadonlySet<string>
}

export interface GateConfig {
  k: number
  masteryThreshold: number
  maxDownPerRecompute: number
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  k: DEFAULT_PRIOR_K,
  masteryThreshold: DEFAULT_MASTERY_THRESHOLD,
  maxDownPerRecompute: DEFAULT_MAX_DOWN_PER_RECOMPUTE,
}

// Per-strand inputs the DB layer supplies for a recompute.
export interface GateInput {
  prior: number             // retained placement estimate (decaying)
  previousGate: number | null // current stored gate, or null on first ever
  n: number                 // scored interactions in the strand so far
}

// Full trace of a single strand's recompute — everything gate_recompute_log
// stores, so `k` can be evaluated against real trajectories (§3.3).
export interface GateResult {
  strand: EarnableStrand
  prior: number
  demonstrated: number
  n: number
  w: number
  k: number
  gateBefore: number | null
  gateAfter: number
  damped: boolean
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

const itemsForStrand = (
  strand: EarnableStrand,
  content: GateContent,
): { id: string; stage: number }[] =>
  strand === 'F'
    ? content.stories
    : content.lessons.filter(l => lessonStrand(l.type) === strand)

/**
 * The level a child's MASTERY evidence supports for a strand, independent of the
 * placement prior and — crucially for F — independent of C (decision i): F reads
 * only mastered stories, never max(F,C).
 *
 * A stage is "cleared" when ≥ ceil(threshold × items at that stage) are mastered.
 * demonstrated = MIN_LEVEL + the length of the CONTIGUOUS run of cleared stages
 * from the lowest stage that exists for the strand. Because it counts only stages
 * that exist and are mastered, it cannot climb past the content that is actually
 * there — the old "headroom" guard is now structural, and re-running never
 * inflates it (BUG-C).
 */
export function demonstratedLevel(
  strand: EarnableStrand,
  content: GateContent,
  threshold: number,
): number {
  const items = itemsForStrand(strand, content)
  if (items.length === 0) return MIN_LEVEL
  const mastered = strand === 'F' ? content.masteredStories : content.masteredLessons

  const byStage = new Map<number, { total: number; done: number }>()
  for (const it of items) {
    const g = byStage.get(it.stage) ?? { total: 0, done: 0 }
    g.total++
    if (mastered.has(it.id)) g.done++
    byStage.set(it.stage, g)
  }

  let cleared = 0
  for (const stage of [...byStage.keys()].sort((a, b) => a - b)) {
    const g = byStage.get(stage)!
    if (g.done >= Math.ceil(threshold * g.total)) cleared++
    else break // contiguous: the first uncleared stage halts the run
  }
  return clamp(MIN_LEVEL + cleared, MIN_LEVEL, MAX_LEVEL)
}

/** Prior weight k/(k+n): 1 at n=0 (placement dominates), → 0 as evidence accrues. */
export function priorWeight(n: number, k: number): number {
  return k / (k + Math.max(0, n))
}

/** Undamped target: the blended prior/evidence level. Pure function of evidence,
 *  so strictly idempotent — the property that kills BUG-C. */
export function targetGate(prior: number, demonstrated: number, n: number, k: number): number {
  const w = priorWeight(n, k)
  return clamp(Math.round(w * prior + (1 - w) * demonstrated), MIN_LEVEL, MAX_LEVEL)
}

/** Apply asymmetric damping (decision 6.4): upward moves are unrestricted; a
 *  downward move is capped at maxDown levels per recompute so one bad session
 *  can't tank a child's gate. Converges to the target over successive recomputes. */
export function dampGate(
  previous: number | null,
  target: number,
  maxDown: number,
): { gate: number; damped: boolean } {
  if (previous === null || target >= previous) return { gate: target, damped: false }
  const floor = clamp(previous - Math.max(0, maxDown), MIN_LEVEL, MAX_LEVEL)
  return target < floor ? { gate: floor, damped: true } : { gate: target, damped: false }
}

/** Recompute the gate for every earnable strand from evidence + prior + config. */
export function recomputeGates(
  inputs: Record<EarnableStrand, GateInput>,
  content: GateContent,
  config: GateConfig,
): GateResult[] {
  return EARNABLE.map(strand => {
    const { prior, previousGate, n } = inputs[strand]
    const demonstrated = demonstratedLevel(strand, content, config.masteryThreshold)
    const target = targetGate(prior, demonstrated, n, config.k)
    const { gate, damped } = dampGate(previousGate, target, config.maxDownPerRecompute)
    return {
      strand, prior, demonstrated, n,
      w: priorWeight(n, config.k), k: config.k,
      gateBefore: previousGate, gateAfter: gate, damped,
    }
  })
}

/**
 * UPWARD gate moves only, as content-unlock events (the client shows "new content
 * unlocked", never a level number/trophy). A downward move is silent — no
 * Promotion is emitted — so a corrected-down child never sees a regression
 * (decision ii + trophy/gate split, §1).
 */
export function promotionsFrom(results: GateResult[]): Promotion[] {
  const out: Promotion[] = []
  for (const r of results) {
    if (r.gateBefore !== null && r.gateAfter > r.gateBefore) {
      out.push({ strand: r.strand, from: r.gateBefore, to: r.gateAfter })
    }
  }
  return out
}
