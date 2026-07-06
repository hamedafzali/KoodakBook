// دنیای اعداد — number/word helpers + age banding for the math rooms.
//
// The math world teaches Persian OVER math skills the child already has from
// school (we never teach arithmetic methods — only the language). Each room
// targets an age band; the hub recommends by age, difficulty adapts inside.

import type { Child } from '@koodakbook/shared'
import { mathAudioUrl, numberToPersianWord } from '@koodakbook/shared'
import { speakOrPlay } from '@/lib/speech'

// Number formatting/words live in shared (the backend synthesizes the audio
// pack from the same source of truth).
export { toPersianDigits, numberToPersianWord, mathAudioUrl } from '@koodakbook/shared'

/** Speak a number: recorded/generated clip first, browser TTS as last resort. */
export function sayNumber(n: number): void {
  speakOrPlay(mathAudioUrl(`n${n}`), numberToPersianWord(n))
}

/** Speak a fixed math phrase by slug (see MATH_PHRASES in shared). */
export function sayPhrase(slug: string, fallbackText: string): void {
  speakOrPlay(mathAudioUrl(slug), fallbackText)
}

/** Child's age from birth_year (falls back to a level-based guess). */
export function childAge(child: Child | null | undefined): number {
  if (child?.birth_year) return Math.max(2, new Date().getFullYear() - child.birth_year)
  const byLevel: Record<number, number> = { 1: 4, 2: 6, 3: 8, 4: 9 }
  return byLevel[child?.level ?? 1] ?? 5
}

export type MathRoom = 'counting' | 'digits' | 'bazaar'

/** Which room fits this age best (hub highlights it; none are locked). */
export function recommendedRoom(age: number): MathRoom {
  if (age <= 5) return 'counting'
  if (age <= 7) return 'digits'
  return 'bazaar'
}

export function shufflePM<T>(a: T[]): T[] { return [...a].sort(() => Math.random() - 0.5) }

/** n distinct wrong answers near a correct value (all ≥ 0, ≠ correct). */
export function distractors(correct: number, count: number, max: number): number[] {
  const out = new Set<number>()
  let guard = 0
  while (out.size < count && guard++ < 100) {
    const d = correct + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3))
    if (d >= 0 && d <= max && d !== correct) out.add(d)
  }
  let fill = 0
  while (out.size < count) { if (fill !== correct && fill <= max) out.add(fill); fill++ }
  return [...out]
}
