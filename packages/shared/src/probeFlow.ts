import type { PlacementProbe, ProbeQuestion } from './types'

/* Placement probe navigation (docs/placement-probe-rebuild.md §3/§6) — which
 * item is on screen right now, given the bank fetched from GET
 * /api/placement/probe and the answers recorded so far. The backend
 * (apps/backend/src/lib/probe.ts) owns picking WHICH words/letters go into
 * the bank and scoring the result; this module owns walking that bank
 * strand-by-strand as the child answers, so web and mobile can't drift on
 * the branch rule (mid→hard/easy) or on what "no usable content" does.
 *
 * Pure and DB-free like reviewFrustration.ts — no rendering, no API calls,
 * unit-testable with no app runtime. Onboarding and reprobe now drive from
 * the exact same step function: the pre-rebuild "stop the whole probe at the
 * first miss" behaviour is gone (§6) — a branch to an easier item is still
 * forward motion, never an abort, for both flows alike. */

export type ProbeStrand = 'V' | 'D' | 'F' | 'C'
export const PROBE_STRAND_ORDER: readonly ProbeStrand[] = ['V', 'D', 'F', 'C']

export interface ProbeResults {
  V: boolean[]
  D: boolean[]
  F: boolean[]
  C: boolean | null
}

export function emptyProbeResults(): ProbeResults {
  return { V: [], D: [], F: [], C: null }
}

export interface ProbeStep {
  strand: ProbeStrand
  role: 'mid' | 'branch' | 'single'
  question: ProbeQuestion
}

/** The item currently on screen, or `null` once every strand has resolved
 *  (or been skipped for lack of content) — the signal to call finish().
 *  Stateless: call it again with the updated results after each answer
 *  rather than tracking a UI index: it always re-derives from scratch, so
 *  there is nothing to keep in sync by hand. */
export function currentProbeStep(bank: PlacementProbe, results: ProbeResults): ProbeStep | null {
  return stepFromStrand(bank, results, 0)
}

function stepFromStrand(bank: PlacementProbe, results: ProbeResults, strandIdx: number): ProbeStep | null {
  if (strandIdx >= PROBE_STRAND_ORDER.length) return null
  const strand = PROBE_STRAND_ORDER[strandIdx]

  if (strand === 'C') {
    if (results.C !== null || !bank.C) return stepFromStrand(bank, results, strandIdx + 1)
    return { strand, role: 'single', question: bank.C }
  }

  const staircase = bank[strand]
  const answered = results[strand]
  if (answered.length === 0) {
    if (!staircase.mid) return stepFromStrand(bank, results, strandIdx + 1)
    return { strand, role: 'mid', question: staircase.mid }
  }
  if (answered.length === 1) {
    // The mid result decides direction (§3) — never both, never neither, and
    // never revealed to the child either way (§6): the branch item reuses the
    // exact same prompt/feedback copy as the mid item did.
    const branchQuestion = answered[0] ? staircase.hard : staircase.easy
    if (!branchQuestion) return stepFromStrand(bank, results, strandIdx + 1)
    return { strand, role: 'branch', question: branchQuestion }
  }
  return stepFromStrand(bank, results, strandIdx + 1)
}

/** Record the answer to the CURRENT step (from currentProbeStep) and return
 *  the updated results to pass to the next currentProbeStep() call. */
export function recordProbeAnswer(results: ProbeResults, step: ProbeStep, correct: boolean): ProbeResults {
  if (step.strand === 'C') return { ...results, C: correct }
  return { ...results, [step.strand]: [...results[step.strand], correct] }
}
