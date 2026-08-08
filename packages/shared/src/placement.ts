/* Placement probe scoring. The probe presents one item per strand in a fixed
 * order (V, D, F, C — see backend routes/placement.ts) and stops at the first
 * miss, so `answers` is a leading run of trues followed by falses. This is the
 * single source of truth for turning that answer vector into a starting level +
 * per-strand levels; the web and mobile placement screens both call it so they
 * can never drift apart. The result is POSTed to /api/placement/result. */

export interface PlacementResult {
  /** Overall starting level (1–4), = 1 + the leading correct streak, capped at 4. */
  level: 1 | 2 | 3 | 4
  /** Per-strand starting level: a passed probe item lifts that strand to 2, else 1. */
  strands: { V: number; D: number; F: number; C: number }
}

/** Probe strand order — index i of `answers` corresponds to STRAND_ORDER[i].
 *  Kept explicit so a change to the probe order is a visible edit here, not a
 *  silent mis-mapping. Must match the question order built in placement.ts. */
export const PLACEMENT_STRAND_ORDER = ['V', 'D', 'F', 'C'] as const

export function scorePlacement(answers: boolean[]): PlacementResult {
  // Consecutive passes from the start → starting stage (1–4).
  let streak = 0
  for (const ok of answers) { if (ok) streak++; else break }
  const level = Math.min(4, 1 + streak) as 1 | 2 | 3 | 4
  // One probe item per strand: a pass lifts that strand to level 2, else 1.
  const strands = { V: 1, D: 1, F: 1, C: 1 }
  PLACEMENT_STRAND_ORDER.forEach((s, i) => { strands[s] = answers[i] ? 2 : 1 })
  return { level, strands }
}
