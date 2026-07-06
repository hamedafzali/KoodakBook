/* ── Persian numbers + math audio pack ──────────────────────
 * Shared by the web math rooms (display + playback) and the backend audio
 * regen job (which synthesizes the pack with the configured section voice).
 * Files live at fixed paths (like phonics): /uploads/math/<slug>.wav
 */

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
  if (n >= 0 && n <= 20) return ONES[n]
  if (n === 100) return 'صد'
  const t = Math.floor(n / 10) * 10
  const r = n % 10
  if (!TENS[t]) return String(n)
  return r === 0 ? TENS[t] : `${TENS[t]} و ${ONES[r]}`
}

/** Diacritized forms for slugs TTS tends to mis-read in isolation. */
const NUMBER_TTS_OVERRIDES: Record<number, string> = { 2: 'دُو', 9: 'نُه', 30: 'سی' }

export function numberTtsText(n: number): string {
  if (NUMBER_TTS_OVERRIDES[n]) return NUMBER_TTS_OVERRIDES[n]
  const t = Math.floor(n / 10) * 10, r = n % 10
  if (n > 20 && n < 100 && r !== 0 && NUMBER_TTS_OVERRIDES[r])
    return `${TENS[t]} و ${NUMBER_TTS_OVERRIDES[r]}`
  return numberToPersianWord(n)
}

/** Fixed feedback/prompt phrases used by the math rooms. */
export const MATH_PHRASES: { slug: string; text: string }[] = [
  { slug: 'afarin', text: 'آفرین!' },
  { slug: 'q-chandta', text: 'چند تا بود؟' },
  { slug: 'try-again', text: 'دوباره تلاش کن!' },
  { slug: 'toman', text: 'تومان' },
]

/** Every clip in the math audio pack (numbers 0–100 + phrases). */
export function mathAudioItems(): { slug: string; text: string }[] {
  const items: { slug: string; text: string }[] = []
  for (let n = 0; n <= 100; n++) items.push({ slug: `n${n}`, text: numberTtsText(n) })
  return items.concat(MATH_PHRASES)
}

/** Client-built fixed path (mirrors phonicsAudioUrl). */
export function mathAudioUrl(slug: string): string {
  return `/uploads/math/${slug}.wav`
}
