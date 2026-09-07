import type { Word } from './types'
import { pickRandom } from './reviewFrustration'

/* Shared board for مارپله across web, mobile solo, and mobile's Simorgh-race
 * mode, so all three stay identical. Knowledge drives the board: ladders are
 * climbed and snakes escaped by answering a word challenge. Originally lived
 * in apps/mobile/lib/marpele.ts (pure TS, no RN import); moved here (2026-09)
 * so web's port can share one source of truth instead of forking it. */
export const SIZE = 30
export const COLS = 5
export const ROWS = SIZE / COLS

// foot → top (climb up on a correct answer)
export const LADDERS: Record<number, number> = { 3: 11, 6: 14, 9: 21, 16: 26 }
// head → tail (slide down on a wrong answer)
export const SNAKES: Record<number, number> = { 13: 4, 19: 8, 24: 15, 28: 18 }

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// pickRandom lives in ./reviewFrustration (identical shuffle-and-slice
// helper) — reused here rather than duplicated.

// Board rows for rendering: square 1 at bottom-left, snaking upward.
export function boardRows(): number[][] {
  const rows: number[][] = []
  for (let r = ROWS - 1; r >= 0; r--) {
    const nums = Array.from({ length: COLS }, (_, i) => r * COLS + i + 1)
    rows.push(r % 2 === 1 ? nums.reverse() : nums)
  }
  return rows
}

// Kept intentionally narrower than either platform's full QuizCard mode union
// (no 'flashcard') — structurally assignable to both, since both QuizCards
// accept a superset.
export type MarpeleQuizMode = 'match_image' | 'listen_tap' | 'name_it'
export interface MarpeleQuestion {
  mode: MarpeleQuizMode
  correctWord: Word
  distractorWords: Word[]
}

export function buildQuestion(pool: Word[], level: number): MarpeleQuestion | null {
  if (pool.length < 4) return null
  const correct = pool[Math.floor(Math.random() * pool.length)]
  const distractors = pickRandom(pool.filter((w) => w.id !== correct.id), 3)
  const modes: MarpeleQuizMode[] = level <= 1 ? ['match_image', 'listen_tap'] : ['match_image', 'listen_tap', 'name_it']
  return { mode: modes[Math.floor(Math.random() * modes.length)], correctWord: correct, distractorWords: distractors }
}

// Words with a picture make better match/name prompts (no «؟»).
export function preferVisual(words: Word[], hasVisual: (w: Word) => boolean): Word[] {
  const withVisual = words.filter(hasVisual)
  return withVisual.length >= 4 ? withVisual : words
}
