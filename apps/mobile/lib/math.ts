import type { Child } from '@koodakbook/shared'
import { mathAudioUrl } from '@koodakbook/shared'
import { playClip } from './sound'

// Mobile counterpart of web's lib/persianMath — same clip pack, no TTS
// fallback (RN has no built-in speech; missing clips just stay silent).
export const sayNumber = (n: number) => playClip(mathAudioUrl(`n${n}`))
export const sayPhrase = (slug: string) => playClip(mathAudioUrl(slug))

/** Child's age from birth_year (falls back to a level-based guess). */
export function childAge(child: Child | null | undefined): number {
  if (child?.birth_year) return Math.max(2, new Date().getFullYear() - child.birth_year)
  const byLevel: Record<number, number> = { 1: 4, 2: 6, 3: 8, 4: 9 }
  return byLevel[child?.level ?? 1] ?? 4
}

/** `n` distinct numbers in 1..max, none equal to `target`. Asks for no more
 *  than the range holds: the loop below never ended when it couldn't (every
 *  current caller has room; this keeps a future one from hanging the app). */
export function distractors(target: number, n: number, max: number): number[] {
  const out = new Set<number>()
  const room = Math.max(0, Math.floor(max) - (target >= 1 && target <= max && Number.isInteger(target) ? 1 : 0))
  const want = Math.min(n, room)
  while (out.size < want) {
    const v = 1 + Math.floor(Math.random() * max)
    if (v !== target) out.add(v)
  }
  return [...out]
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
