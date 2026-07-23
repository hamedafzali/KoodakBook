import type { Word } from '@koodakbook/shared'
import type { QuizMode, QuizQuestion } from '@/components/QuizCard'

// Shared board for both مارپله games (solo V1 + Simorgh race V2) so they stay
// identical. Knowledge drives the board: ladders are climbed and snakes escaped
// by answering a word challenge.
export const SIZE = 30
export const COLS = 5
export const ROWS = SIZE / COLS

// foot → top (climb up on a correct answer)
export const LADDERS: Record<number, number> = { 3: 11, 6: 14, 9: 21, 16: 26 }
// head → tail (slide down on a wrong answer)
export const SNAKES: Record<number, number> = { 13: 4, 19: 8, 24: 15, 28: 18 }

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

// Board rows for rendering: square 1 at bottom-left, snaking upward.
export function boardRows(): number[][] {
  const rows: number[][] = []
  for (let r = ROWS - 1; r >= 0; r--) {
    const nums = Array.from({ length: COLS }, (_, i) => r * COLS + i + 1)
    rows.push(r % 2 === 1 ? nums.reverse() : nums)
  }
  return rows
}

export function buildQuestion(pool: Word[], level: number): QuizQuestion | null {
  if (pool.length < 4) return null
  const correct = pool[Math.floor(Math.random() * pool.length)]
  const distractors = pickRandom(pool.filter((w) => w.id !== correct.id), 3)
  const modes: QuizMode[] = level <= 1 ? ['match_image', 'listen_tap'] : ['match_image', 'listen_tap', 'name_it']
  return { mode: modes[Math.floor(Math.random() * modes.length)], correctWord: correct, distractorWords: distractors }
}

// Words with a picture make better match/name prompts (no «؟»).
export function preferVisual(words: Word[], hasVisual: (w: Word) => boolean): Word[] {
  const withVisual = words.filter(hasVisual)
  return withVisual.length >= 4 ? withVisual : words
}
