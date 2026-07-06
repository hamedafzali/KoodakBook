// دنیای اعداد — number/word helpers + age banding for the math rooms.
//
// The math world teaches Persian OVER math skills the child already has from
// school (we never teach arithmetic methods — only the language). Each room
// targets an age band; the hub recommends by age, difficulty adapts inside.

import type { Child } from '@koodakbook/shared'

/** Western → Persian-Indic digits: 456 → ۴۵۶ */
export function toPersianDigits(n: number | string): string {
  const map = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(n).replace(/[0-9]/g, d => map[+d])
}

const ONES = ['صفر', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده',
  'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده', 'بیست']
const TENS: Record<number, string> = { 20: 'بیست', 30: 'سی', 40: 'چهل', 50: 'پنجاه', 60: 'شصت', 70: 'هفتاد', 80: 'هشتاد', 90: 'نود' }

/** 0–100 in Persian words: 23 → «بیست و سه» */
export function numberToPersianWord(n: number): string {
  if (n <= 20) return ONES[n] ?? String(n)
  if (n === 100) return 'صد'
  const t = Math.floor(n / 10) * 10
  const r = n % 10
  return r === 0 ? TENS[t] : `${TENS[t]} و ${ONES[r]}`
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
