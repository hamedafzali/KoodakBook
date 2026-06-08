import { query } from './db'

/**
 * Weekly parent digest — celebrates each child's progress over the last 7 days.
 *
 * Sends via Resend (https://resend.com) using plain fetch (no SDK dependency).
 * If RESEND_API_KEY is not set it does a DRY RUN: the email is logged instead of
 * sent, so the whole pipeline is testable before you have credentials. To go live:
 *   RESEND_API_KEY=...   DIGEST_FROM="KoodakBook <digest@yourdomain.com>"
 * (the from-domain must be verified in Resend) and WEB_URL=https://yourdomain.com
 */

const FROM = process.env.DIGEST_FROM ?? 'KoodakBook <digest@koodakbook.com>'
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@koodakbook.com'

interface ChildWeek {
  name: string
  new_words: number
  stories: number
  minutes: number
  active_days: number
  total_words: number
}

async function childWeekStats(childId: string, name: string): Promise<ChildWeek> {
  const [words, stories, sessions, totals] = await Promise.all([
    query<{ n: string }>(
      `select count(*)::int as n from child_word_progress
       where child_id = $1 and introduced_at > now() - interval '7 days'`, [childId]),
    query<{ n: string }>(
      `select count(*)::int as n from child_story_progress
       where child_id = $1 and completed = true and last_read_at > now() - interval '7 days'`, [childId]),
    query<{ days: string; secs: string }>(
      `select count(distinct started_at::date)::int as days,
              coalesce(sum(duration_sec), 0)::int as secs
       from child_sessions
       where child_id = $1 and started_at > now() - interval '7 days'`, [childId]),
    query<{ n: string }>(
      `select count(*)::int as n from child_word_progress
       where child_id = $1 and status <> 'introduced'`, [childId]),
  ])
  return {
    name,
    new_words: Number(words[0]?.n ?? 0),
    stories: Number(stories[0]?.n ?? 0),
    minutes: Math.round(Number(sessions[0]?.secs ?? 0) / 60),
    active_days: Number(sessions[0]?.days ?? 0),
    total_words: Number(totals[0]?.n ?? 0),
  }
}

function hasActivity(c: ChildWeek): boolean {
  return c.active_days > 0 || c.new_words > 0 || c.stories > 0
}

function renderEmail(children: ChildWeek[]): { subject: string; html: string; text: string } {
  const first = children[0]
  const subject = children.length === 1
    ? `این هفته ${first.name} ${first.new_words} کلمه‌ی جدید یاد گرفت! 🌟`
    : `گزارش هفتگی کوداک‌بوک 🌟`

  const cards = children.map(c => `
    <div style="background:#fff7ed;border-radius:20px;padding:20px;margin:0 0 16px">
      <h2 style="margin:0 0 12px;color:#ea580c;font-size:20px">${esc(c.name)}</h2>
      <table style="width:100%;text-align:center;border-collapse:collapse">
        <tr>
          <td>${stat('⭐', c.new_words, 'کلمه‌ی جدید')}</td>
          <td>${stat('📖', c.stories, 'داستان')}</td>
          <td>${stat('🔥', c.active_days, 'روز فعال')}</td>
          <td>${stat('⏱️', c.minutes, 'دقیقه')}</td>
        </tr>
      </table>
      <p style="margin:14px 0 0;color:#6b7280;font-size:13px;text-align:center">
        مجموع کلمه‌های یادگرفته: <b>${c.total_words}</b>
      </p>
    </div>`).join('')

  const html = `<!doctype html><html lang="fa" dir="rtl"><body style="margin:0;background:#f8fafc;font-family:Tahoma,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:24px">
      <div style="background:linear-gradient(135deg,#fbbf24,#fb923c,#fb7185);border-radius:24px;padding:28px;text-align:center;color:#fff">
        <div style="font-size:48px">🦚</div>
        <h1 style="margin:8px 0 0;font-size:22px">گزارش هفتگی شما</h1>
        <p style="margin:6px 0 0;opacity:.9;font-size:14px">ببینید این هفته فرزندتان چه یاد گرفت</p>
      </div>
      <div style="padding:24px 0">${cards}</div>
      <div style="text-align:center">
        <a href="${WEB_URL}/parent/dashboard" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:16px">دیدن داشبورد کامل ←</a>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:28px">کوداک‌بوک · KoodakBook</p>
    </div></body></html>`

  const text = children.map(c =>
    `${c.name}: ${c.new_words} کلمه‌ی جدید، ${c.stories} داستان، ${c.active_days} روز فعال، ${c.minutes} دقیقه.`
  ).join('\n') + `\n\nداشبورد: ${WEB_URL}/parent/dashboard`

  return { subject, html, text }
}

function stat(emoji: string, n: number, label: string): string {
  return `<div style="font-size:24px">${emoji}</div>
    <div style="font-size:22px;font-weight:bold;color:#ea580c">${n}</div>
    <div style="font-size:12px;color:#6b7280">${label}</div>`
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<'sent' | 'dry-run' | 'error'> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log(`[digest] DRY RUN → ${to}\n  subject: ${subject}\n  ${text.replace(/\n/g, '\n  ')}`)
    return 'dry-run'
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    })
    if (!r.ok) {
      console.error(`[digest] Resend error ${r.status} for ${to}: ${await r.text()}`)
      return 'error'
    }
    return 'sent'
  } catch (err) {
    console.error(`[digest] send failed for ${to}:`, err)
    return 'error'
  }
}

/** Build and send the weekly digest to every parent who has an active child. */
export async function runWeeklyDigest(): Promise<{ sent: number; dryRun: number; skipped: number; errors: number }> {
  const parents = await query<{ id: string; email: string }>(
    `select u.id, u.email from users u
     where u.email <> $1 and exists (select 1 from children c where c.parent_id = u.id)`,
    [ADMIN_EMAIL]
  )
  const out = { sent: 0, dryRun: 0, skipped: 0, errors: 0 }

  for (const parent of parents) {
    const kids = await query<{ id: string; name: string }>(
      'select id, name from children where parent_id = $1 order by created_at', [parent.id]
    )
    const stats: ChildWeek[] = []
    for (const k of kids) stats.push(await childWeekStats(k.id, k.name))

    const active = stats.filter(hasActivity)
    if (active.length === 0) { out.skipped++; continue }  // don't email inactive families

    const { subject, html, text } = renderEmail(active)
    const result = await sendEmail(parent.email, subject, html, text)
    if (result === 'sent') out.sent++
    else if (result === 'dry-run') out.dryRun++
    else out.errors++
  }
  console.log(`[digest] done: ${JSON.stringify(out)}`)
  return out
}
