import { leitnerNext } from './leitner'

/* Word-progress write routing (dual-track SR). Pure decision layer: given the
 * word's previous state and one interaction, it returns exactly which columns to
 * write, per track. routes/progress.ts reads the row, calls this, and applies
 * the plan — so this is the real logic, unit-tested in wordProgress.test.ts
 * without a database.
 *
 * The two tracks schedule INDEPENDENTLY (project.md §11.1): a receptive rep
 * (hear→recognise) drives the legacy/authoritative box + due_at that the review
 * endpoint reads; a productive rep (say/recall) drives its own box_productive +
 * due_productive and NEVER touches the receptive schedule. Mastery is the one
 * shared state both tracks enrich.
 *
 * BUG-A guard: `plan.receptive === null` on every productive interaction — a
 * child failing to PRODUCE a word must not reset its receptive review schedule.
 * The unit tests assert exactly this, so a regression fails `npm test` rather
 * than silently mis-scheduling reviews in production. */

export type Track = 'receptive' | 'productive'
export type WordStatus = 'introduced' | 'practiced' | 'mastered'
export type Mastery = 'introduced' | 'practicing' | 'mastered' | 'consolidated'

/** The columns of child_word_progress this planner needs from the current row. */
export interface WordProgressPrev {
  box: number
  status: WordStatus
  mastered_at: string | null
  box_productive: number | null
  mastery: Mastery
}

export interface WordProgressPlan {
  /** Legacy + receptive schedule columns to write. NULL on a productive
   *  interaction — the receptive schedule is left exactly as it was. */
  receptive: {
    box: number
    intervalDays: number
    status: WordStatus
    /** Stamp mastered_at = now (only when first reaching mastered). */
    stampMasteredAt: boolean
  } | null
  /** Productive schedule columns to write. NULL on a receptive interaction. */
  productive: {
    box: number
    intervalDays: number
  } | null
  /** Shared mastery state (enriched by whichever track this rep is). */
  mastery: Mastery
}

function statusToMastery(status: WordStatus): Mastery {
  return status === 'mastered' ? 'mastered' : status === 'practiced' ? 'practicing' : 'introduced'
}

export function planWordProgress(
  prev: WordProgressPrev | null,
  input: { track: Track; correct: boolean; status: WordStatus },
): WordProgressPlan {
  const { track, correct, status } = input

  if (track === 'productive') {
    // Productive: own Leitner track, starting from box 0 for a never-produced
    // word. Never touches the receptive schedule (BUG-A) and never masters —
    // it only enriches mastery up to 'practicing', preserving mastered/consolidated.
    const { box, intervalDays } = leitnerNext(prev?.box_productive ?? 0, correct)
    const mastery: Mastery =
      prev && (prev.mastery === 'mastered' || prev.mastery === 'consolidated') ? prev.mastery : 'practicing'
    return { receptive: null, productive: { box, intervalDays }, mastery }
  }

  // Receptive (default): drives the legacy/authoritative schedule the review
  // endpoint reads; box_receptive/due_receptive mirror it in the route.
  if (!prev) {
    // First-ever receptive exposure: enters box 1, due tomorrow, status as declared.
    return {
      receptive: { box: 1, intervalDays: 1, status, stampMasteredAt: status === 'mastered' },
      productive: null,
      mastery: statusToMastery(status),
    }
  }
  const { box, intervalDays } = leitnerNext(prev.box, correct)
  const reachedMastered = correct && box >= 5
  const nextStatus: WordStatus =
    reachedMastered ? 'mastered' : prev.status === 'mastered' ? 'mastered' : 'practiced'
  return {
    receptive: {
      box,
      intervalDays,
      status: nextStatus,
      stampMasteredAt: reachedMastered && prev.mastered_at === null,
    },
    productive: null,
    mastery: statusToMastery(nextStatus),
  }
}
