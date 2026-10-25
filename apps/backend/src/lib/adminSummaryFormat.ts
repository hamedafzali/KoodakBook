/* Pure helpers for the daily admin summary (lib/adminSummary.ts): no
 * database, no network, so they are unit-testable on their own. */

/** The local date (YYYY-MM-DD) and hour in `tz` at `at`. */
export function localDateHour(at: Date, tz: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

export interface DailyNumbers {
  signups: number; total_families: number
  new_children: number; active_children: number; active_children_7d: number
  sessions: number; minutes: number
  lessons_done: number; stories_done: number; ai_stories: number
  ai_translate_pages: number; ai_audio_pages: number
  temp_grants: number; premium_active: number; paying: number
  new_subscriptions: number
  leads_today: number; leads_open: number
  feedback_today: number; feedback_open: number
  drafts_pending: number; word_images_pending: number; covers_pending: number
}

const fa = (n: number) => n.toLocaleString('fa-IR')

export function formatSummary(day: string, n: DailyNumbers): string {
  const lines = [
    `📊 گزارش روزانه کودک‌بوک · ${day}`,
    '',
    '👨‍👩‍👧 خانواده‌ها',
    `• ثبت‌نام امروز: ${fa(n.signups)} (کل: ${fa(n.total_families)})`,
    `• کودک تازه: ${fa(n.new_children)}`,
    '',
    '📚 یادگیری',
    `• کودک فعال امروز: ${fa(n.active_children)} (۷ روز: ${fa(n.active_children_7d)})`,
    `• جلسه‌ها: ${fa(n.sessions)}، ${fa(n.minutes)} دقیقه`,
    `• درس تمام‌شده: ${fa(n.lessons_done)}، داستان تمام‌شده: ${fa(n.stories_done)}`,
    `• داستان هوش مصنوعی: ${fa(n.ai_stories)}`,
    '',
    '💳 درآمد و پلن‌ها',
    `• اشتراک تازه: ${fa(n.new_subscriptions)}، مشترک پرداختی: ${fa(n.paying)}`,
    `• پریمیوم فعال (با هدیه/آزمایشی): ${fa(n.premium_active)}، هدیه‌ی امروز: ${fa(n.temp_grants)}`,
    '',
    '🗂 کارهای منتظر',
    `• بازخورد خانواده‌ها: ${fa(n.feedback_today)} تازه (باز: ${fa(n.feedback_open)})`,
    `• درخواست تازه: ${fa(n.leads_today)} (باز: ${fa(n.leads_open)})`,
    `• صف تلگرام: ${fa(n.drafts_pending)}، تصویر کلمه: ${fa(n.word_images_pending)}، جلد داستان: ${fa(n.covers_pending)}`,
  ]
  if (n.ai_translate_pages || n.ai_audio_pages) {
    lines.push('', `🤖 مصرف هوش مصنوعی: ترجمه ${fa(n.ai_translate_pages)} صفحه، صدا ${fa(n.ai_audio_pages)} صفحه`)
  }
  return lines.join('\n')
}

