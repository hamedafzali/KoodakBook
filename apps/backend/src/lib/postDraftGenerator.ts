/**
 * AI-scheduled content for the Telegram approval queue (docs/telegram-approval-queue.md).
 *
 * Three fixed content types on fixed schedules — deliberately not an
 * open-ended "AI decides what to post". Each one:
 *   1. gathers real, DB-sourced facts (never lets the model invent app content)
 *   2. asks the model to turn those facts into short Persian copy (lib/ai.generatePostText)
 *   3. runs the result through the deterministic content gate (lib/postGuard)
 *   4. on pass: queues it as a pending draft (routes/adminPostDrafts.createDraft)
 *      on fail: discards it and notifies the admin — never queues something
 *      the gate rejected, and never silently drops it either
 *
 * The gate is a second, independent check ahead of human approval, not a
 * substitute for it: every draft that reaches the queue still needs someone
 * to confirm it before anything posts.
 *
 * Invoked by scripts/generatePostDrafts.ts (external cron) or the manual
 * admin-triggered endpoint (POST /admin/post-drafts/generate/:kind), same
 * split as the weekly digest (lib/digest.ts / scripts/sendDigests.ts).
 */

import { query } from './db'
import { getAiSettings, generatePostText, type PostKind } from './ai'
import { validDraftText } from './postGuard'

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000'
const LINK_HOST = (() => { try { return new URL(WEB_URL).host } catch { return undefined } })()

export interface GenerateResult {
  kind: PostKind
  outcome: 'queued' | 'skipped-not-due' | 'gate-rejected' | 'ai-not-configured' | 'error'
  detail?: string
}

const WEEKLY_TIP_TOPICS = [
  'اهمیت خواندن بلندبلند برای کودک، حتی چند دقیقه در روز',
  'گفت‌وگو درباره‌ی تصویرهای کتاب پیش از خواندن متن',
  'تکرار یک داستان محبوب، به‌جای همیشه رفتن سراغ داستان تازه',
  'کلمات تازه را در مکالمه‌ی روزمره هم به کار ببرید',
  'گذاشتن وقت ثابت روزانه برای زبان فارسی، حتی کوتاه',
]

/** Deterministic weekly rotation — same topic all week if run more than once,
 *  a different one next week, no randomness to make output non-reproducible. */
function weekOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.floor((d.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000))
}

async function generateWeeklyTip(): Promise<string> {
  const topic = WEEKLY_TIP_TOPICS[weekOfYear(new Date()) % WEEKLY_TIP_TOPICS.length]
  const settings = await getAiSettings()
  if (!settings) throw new Error('AI not configured')
  const text = await generatePostText(settings, { kind: 'weekly_tip', context: `موضوع این هفته: ${topic}` })
  return `💡 ${text}\n\n${WEB_URL}`
}

/** "This week's new words" — words has no created_at (schema constraint), so
 *  this is a rotating themed showcase (seeded by ISO week, so re-running the
 *  same week is stable) rather than literally rows inserted in the last 7
 *  days. Named "roundup" rather than "new" in code for that reason; the
 *  Persian copy itself is still allowed to read as a fresh weekly pick. */
async function generateWordRoundup(): Promise<string> {
  const seed = weekOfYear(new Date())
  const words = await query<{ persian: string; english: string; category: string }>(
    `select persian, english, category from words order by md5(id::text || $1::text) limit 6`,
    [seed],
  )
  if (words.length === 0) throw new Error('no words available')
  const list = words.map(w => `${w.persian} (${w.english})`).join('، ')
  const settings = await getAiSettings()
  if (!settings) throw new Error('AI not configured')
  const text = await generatePostText(settings, {
    kind: 'word_roundup',
    context: `این کلمات را معرفی کن: ${list}`,
  })
  return `📚 ${text}\n\n${WEB_URL}`
}

// Nowruz: fixed ~Mar 19-21 (varies with the equinox; a 3-day window covers it
// without pinning an exact day per year). Yalda: night of Dec 20-21.
function isNowruzWindow(d: Date): boolean {
  return d.getMonth() === 2 && d.getDate() >= 19 && d.getDate() <= 21
}
function isYaldaWindow(d: Date): boolean {
  return d.getMonth() === 11 && d.getDate() >= 20 && d.getDate() <= 21
}

async function generateHoliday(now: Date): Promise<string | null> {
  const holiday = isNowruzWindow(now) ? 'نوروز' : isYaldaWindow(now) ? 'شب یلدا' : null
  if (!holiday) return null
  const settings = await getAiSettings()
  if (!settings) throw new Error('AI not configured')
  const text = await generatePostText(settings, { kind: 'holiday', context: `مناسبت: ${holiday}` })
  return `🎉 ${text}\n\n${WEB_URL}`
}

async function tryGenerate(kind: PostKind, build: () => Promise<string | null>): Promise<GenerateResult> {
  const { createDraft } = await import('../routes/adminPostDrafts')
  const { AiNotConfiguredError } = await import('./ai')
  const { notifyDraftGenerationFailed } = await import('./adminNotify')

  let text: string | null
  try {
    text = await build()
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return { kind, outcome: 'ai-not-configured' }
    return { kind, outcome: 'error', detail: (err as Error).message }
  }
  if (text === null) return { kind, outcome: 'skipped-not-due' }

  // One retry on a gate failure (same shape as characters.ts's chat retry) —
  // a single bad generation shouldn't need a human to notice and re-run it.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (text !== null && validDraftText(text, { allowedLinkHost: LINK_HOST })) {
      await createDraft({ source: 'ai_scheduled', source_ref: kind, text })
      return { kind, outcome: 'queued' }
    }
    if (attempt === 0) {
      try { text = await build() } catch { break }
    }
  }
  notifyDraftGenerationFailed({ kind, reason: 'محتوای تولیدشده از فیلتر ایمنی رد شد' }).catch(() => {})
  return { kind, outcome: 'gate-rejected' }
}

/** Run all three scheduled generators once. Holiday content skips itself
 *  outside its date window (not an error). Safe to run daily via cron — the
 *  weekly ones are seeded by ISO week so running more than once in the same
 *  week just re-drafts the same content rather than drifting. */
export async function runScheduledPostDrafts(now = new Date()): Promise<GenerateResult[]> {
  return Promise.all([
    tryGenerate('weekly_tip', () => generateWeeklyTip()),
    tryGenerate('word_roundup', () => generateWordRoundup()),
    tryGenerate('holiday', () => generateHoliday(now)),
  ])
}
