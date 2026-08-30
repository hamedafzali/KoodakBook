import { leitnerNext } from './leitner'
import { nextConsecutiveMisses, missIntervalDays, DEFAULT_FRUSTRATION_CONFIG, type FrustrationConfig } from './frustration'

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
 * than silently mis-scheduling reviews in production.
 *
 * consecutive_misses (mig-051, receptive only) rides along on the receptive
 * plan: it drives the frustration-loop presentation flags the review endpoint
 * attaches to each due word (see frustration.ts), and can push a still-missed
 * word's due date out further than the standard box-1 interval. */

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
  /** Optional so existing callers/tests need not know about it; missing = 0. */
  consecutive_misses?: number
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
    /** mig-051: miss streak on this word, receptive track only. */
    consecutiveMisses: number
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
  frustrationConfig: FrustrationConfig = DEFAULT_FRUSTRATION_CONFIG,
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
    // A miss straight out of introduction is unusual but not impossible (e.g. a
    // 'practiced'/'mastered' status can arrive from a lesson replay); consecutive
    // misses still starts counting from here rather than assuming 0 unconditionally.
    const consecutiveMisses = nextConsecutiveMisses(0, correct)
    return {
      receptive: {
        box: 1,
        intervalDays: missIntervalDays(consecutiveMisses, 1, frustrationConfig),
        status,
        stampMasteredAt: status === 'mastered',
        consecutiveMisses,
      },
      productive: null,
      mastery: statusToMastery(status),
    }
  }
  const { box, intervalDays } = leitnerNext(prev.box, correct)
  const reachedMastered = correct && box >= 5
  const nextStatus: WordStatus =
    reachedMastered ? 'mastered' : prev.status === 'mastered' ? 'mastered' : 'practiced'
  const consecutiveMisses = nextConsecutiveMisses(prev.consecutive_misses ?? 0, correct)
  return {
    receptive: {
      box,
      intervalDays: missIntervalDays(consecutiveMisses, intervalDays, frustrationConfig),
      status: nextStatus,
      stampMasteredAt: reachedMastered && prev.mastered_at === null,
      consecutiveMisses,
    },
    productive: null,
    mastery: statusToMastery(nextStatus),
  }
}
