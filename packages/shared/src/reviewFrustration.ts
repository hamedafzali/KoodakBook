import type { ReviewItem, Word } from './types'

/* Review-session question building, including the frustration loop's
 * client-side half (mig-051). The backend (`apps/backend/src/lib/frustration.ts`)
 * owns the thresholds and attaches `easing`/`needsReteach` to each due word;
 * this module owns what to DO about those flags — which mode to quiz in,
 * which distractors to use, and when to insert a no-scoring re-teach beat or
 * pad a session with easy wins. Web and mobile both call this so the two
 * clients can't drift on what the flags mean (they did once — this file is
 * the fix).
 *
 * Pure and DB-free like `placement.ts`/the backend's `gate.ts`/`frustration.ts`
 * — no rendering, no API calls, so it's unit-testable with no app runtime. */

export type ReviewQuizMode = 'flashcard' | 'listen_tap' | 'match_image' | 'name_it'

export interface ReviewQuizQuestion {
  mode: ReviewQuizMode
  correctWord: Word
  distractorWords?: Word[]
}

export function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

// `easing`: prefer listen_tap over match_image. Of the two review modes,
// match_image's answer options are TEXT-ONLY — it silently assumes Persian
// literacy. listen_tap's options carry an image/emoji AND a label, which is
// the more supported mode for a pre-reader. Distractors also prefer a
// different category than the target when the pool allows it, since a
// same-category near-neighbor (two foods, two animals) is the harder
// discrimination and this is exactly the moment to avoid it.
export function easedQuestion(word: Word, pool: Word[]): ReviewQuizQuestion {
  const others = pool.filter(w => w.id !== word.id)
  const differentCategory = others.filter(w => w.category !== word.category)
  const distractorPool = differentCategory.length >= 3 ? differentCategory : others
  return { mode: 'listen_tap', correctWord: word, distractorWords: pickRandom(distractorPool, 3) }
}

// `needsReteach`: a no-scoring look-and-listen beat before the quiz attempt,
// reusing the flashcard mode verbatim — the same component/props lessons use
// to introduce a word for the first time, not a new remediation screen that
// would look different from how words are normally taught. Also reused for
// stage-3 win-padding below (a flashcard is a flashcard either way).
export function reteachQuestion(word: Word): ReviewQuizQuestion {
  return { mode: 'flashcard', correctWord: word }
}

/** Turn a session's due items into the actual question sequence: a re-teach
 *  beat ahead of any item still needing one, then the (possibly eased) quiz
 *  attempt itself. `needsReteach` implies `easing` too (both key off the same
 *  rising miss count) — the quiz attempt right after a re-teach stays eased. */
export function buildReviewQuestions(items: ReviewItem[], pool: Word[]): ReviewQuizQuestion[] {
  const modes: ReviewQuizMode[] = ['match_image', 'listen_tap']
  const out: ReviewQuizQuestion[] = []
  for (const it of items) {
    if (it.needsReteach) out.push(reteachQuestion(it.word))
    out.push(it.easing
      ? easedQuestion(it.word, pool)
      : {
          mode: modes[Math.floor(Math.random() * modes.length)],
          correctWord: it.word,
          distractorWords: pickRandom(pool.filter(w => w.id !== it.word.id), 3),
        })
  }
  return out
}

/** Stage 3 padding: quick, unscored wins to append when a word is still
 *  missed right after its re-teach beat, so the session doesn't end on a
 *  loss streak. Draws from words already gotten right THIS session rather
 *  than fetching mastered words fresh — bench happens server-side via
 *  `missIntervalDays`; this is purely cosmetic, session-local comfort. */
export function buildPaddingQuestions(sessionWins: Word[], count = 2): ReviewQuizQuestion[] {
  return pickRandom(sessionWins, count).map(reteachQuestion)
}
