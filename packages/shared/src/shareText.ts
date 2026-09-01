import { toPersianDigits } from './persianNumbers'
import type { DashboardSummary } from './types'

/**
 * The parent-facing "share my child's progress" message (web WhatsApp/native
 * share, mobile OS share sheet). One implementation so wording and number
 * formatting can't drift between apps again — see mig history around the
 * کوداک‌بوک misspelling and the missing toPersianDigits call on web.
 *
 * Framed as a soft recommendation, not just a brag: most recipients are other
 * diaspora Persian parents deciding whether this is worth a look for their
 * own kid, not just family checking in.
 */
export function buildShareText(summary: Pick<DashboardSummary, 'child' | 'words_learned'>): string {
  const words = toPersianDigits(summary.words_learned)
  return `«${summary.child.name}» با کودک‌بوک داره فارسی یاد می‌گیره — روزی ۱۰ دقیقه، با قصه. ` +
    `تا حالا ${words} کلمه! اگر بچه‌تون هم فارسی کم داره، ارزش یه نگاه رو داره 🌟`
}
