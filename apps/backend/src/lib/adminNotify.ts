/**
 * Private admin Telegram DMs — pings the operator's own chat about events
 * worth knowing about right away: new signups, lead/contact submissions,
 * payments, server errors, and a once-a-day summary. No channel, no approval
 * step, no queue: this is a direct heads-up, not content publishing.
 *
 * Same shape as lib/telegramChannel.ts and lib/alerts: plain fetch against
 * Telegram's Bot API, DRY-RUNS (logs instead of sending) when
 * ADMIN_TELEGRAM_BOT_TOKEN isn't set, so the pipeline is exercisable before a
 * bot exists.
 *
 * This is a THIRD, separate bot/token from both TELEGRAM_BOT_TOKEN
 * (lib/telegramChannel — public content channel) and ALERT_TELEGRAM_BOT_TOKEN
 * (lib/alerts — ops reliability paging). Same reasoning as those two being
 * kept apart from each other: a bot only ever needs the one capability it was
 * made for, so a leaked/misused token can't also post to the public channel
 * or page on-call. See docs/admin-notify.md for @BotFather setup.
 *
 * Every notify* function is fire-and-forget on the caller's side: callers
 * attach `.catch(() => {})` and never await it on a request's critical path.
 * Nothing here throws on a Telegram or database hiccup.
 */

import { query } from './db'

const TG_BASE = process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org'
const TG_TOKEN = process.env.ADMIN_TELEGRAM_BOT_TOKEN ?? ''
const TG_CHAT = process.env.ADMIN_TELEGRAM_CHAT_ID ?? ''
// Telegram rejects a message over 4096 characters; leave room for the tail.
const MAX_LEN = 3900

export type NotifyResult = 'sent' | 'dry-run' | 'error' | 'throttled'

export async function sendMessage(text: string): Promise<NotifyResult> {
  const body = text.length > MAX_LEN ? `${text.slice(0, MAX_LEN)}…` : text
  if (!TG_TOKEN || !TG_CHAT) {
    console.log(`[admin-notify] DRY RUN → admin\n  ${body.replace(/\n/g, '\n  ')}`)
    return 'dry-run'
  }
  try {
    const r = await fetch(`${TG_BASE}/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: body, disable_web_page_preview: true }),
    })
    if (!r.ok) {
      console.error(`[admin-notify] sendMessage error ${r.status}: ${await r.text()}`)
      return 'error'
    }
    return 'sent'
  } catch (err) {
    console.error('[admin-notify] send failed:', err)
    return 'error'
  }
}

// ── Throttling ─────────────────────────────────────────────
// Kept in the database (admin_notify_log, migration 067) so it survives a
// restart: a crash loop must not page once per restart. If the database is
// the thing that is down, fall back to an in-memory window — better one
// message per process than none at all, or one per failed request.
const memoryWindow = new Map<string, number>()

/** Whether a message with this key may go out now (at most one per
 *  `minutes`), and how many were held back since the last one that did. */
export async function claimSlot(key: string, minutes: number): Promise<{ send: boolean; suppressed: number }> {
  try {
    const rows = await query<{ send: boolean; prev_suppressed: number | null }>(
      `with prev as (select suppressed from admin_notify_log where key = $1)
       insert into admin_notify_log as l (key, last_sent_at, suppressed) values ($1, now(), 0)
       on conflict (key) do update set
         last_sent_at = case when l.last_sent_at < now() - make_interval(mins => $2::int) then now() else l.last_sent_at end,
         suppressed   = case when l.last_sent_at < now() - make_interval(mins => $2::int) then 0 else l.suppressed + 1 end
       returning (last_sent_at = now()) as send, (select suppressed from prev) as prev_suppressed`,
      [key, minutes],
    )
    const row = rows[0]
    return { send: !!row?.send, suppressed: row?.prev_suppressed ?? 0 }
  } catch {
    const now = Date.now()
    const last = memoryWindow.get(key) ?? 0
    if (now - last < minutes * 60_000) return { send: false, suppressed: 0 }
    memoryWindow.set(key, now)
    return { send: true, suppressed: 0 }
  }
}

async function sendThrottled(key: string, minutes: number, text: string, heldBack = 'مورد مشابه از پیام قبلی'): Promise<NotifyResult> {
  const slot = await claimSlot(key, minutes)
  if (!slot.send) return 'throttled'
  return sendMessage(slot.suppressed > 0 ? `${text}\n(+${slot.suppressed} ${heldBack})` : text)
}

const oneLine = (s: string, max = 300) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

// ── Accounts & leads ───────────────────────────────────────

/** A new account was created. */
export async function notifyNewSignup(input: { email: string }): Promise<NotifyResult> {
  return sendMessage(`👤 ثبت‌نام جدید\n${input.email}`)
}

/** A tablet/waitlist/contact form was submitted (routes/leads.ts). */
export async function notifyNewLead(input: {
  type: 'tablet' | 'app_waitlist' | 'contact'
  name?: string | null
  email: string
  message?: string | null
}): Promise<NotifyResult> {
  const label = { tablet: 'پیش‌ثبت‌نام تبلت', app_waitlist: 'لیست انتظار اپ', contact: 'تماس' }[input.type]
  const lines = [
    `📬 ${label}`,
    input.name ? `${input.name} — ${input.email}` : input.email,
  ]
  if (input.message) lines.push(input.message)
  return sendMessage(lines.join('\n'))
}

/** A family sent feedback: the website contact form or the parent area. */
export async function notifyNewFeedback(input: {
  kind: string
  source: string
  email: string
  name: string | null
  message: string
  signedIn: boolean
  screen: string | null
}): Promise<NotifyResult> {
  const kind = ({ idea: '💡 پیشنهاد', problem: '🐞 مشکل', question: '❓ سؤال', other: '💬 پیام' } as Record<string, string>)[input.kind] ?? '💬 پیام'
  const where = ({ site: 'سایت', parent_web: 'بخش والدین (وب)', parent_mobile: 'بخش والدین (اپ)' } as Record<string, string>)[input.source] ?? input.source
  const who = `${input.name ? `${input.name} — ` : ''}${input.email}${input.signedIn ? ' (حساب کاربری)' : ''}`
  const lines = [`💬 بازخورد تازه · ${kind}`, `از: ${who}`, `کجا: ${where}${input.screen ? ` · ${input.screen}` : ''}`, '', input.message.trim().slice(0, 1500)]
  return sendMessage(lines.join('\n'))
}

// ── Telegram channel queue ─────────────────────────────────

/** A new post draft is waiting for review in the admin panel (routes/adminPostDrafts.ts). */
export async function notifyNewDraft(input: { id: string; preview: string }): Promise<NotifyResult> {
  const short = input.preview.length > 200 ? `${input.preview.slice(0, 200)}…` : input.preview
  return sendMessage(`📝 پیش‌نویس تازه در صف تأیید تلگرام\n${short}`)
}

/** An AI-scheduled draft was generated but discarded by the deterministic
 *  content gate (lib/postGuard) before it ever reached the review queue —
 *  surfaced so a silently-dropped generation isn't invisible. */
export async function notifyDraftGenerationFailed(input: { kind: string; reason: string }): Promise<NotifyResult> {
  return sendMessage(`⚠️ پیش‌نویس خودکار (${input.kind}) رد شد و به صف نرسید\n${input.reason}`)
}

// ── Billing (routes/billingWebhook.ts) ─────────────────────

const date = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')

/** A family completed Stripe checkout and is now on premium. */
export async function notifySubscriptionStarted(input: { email: string; periodEnd: string | null; trial: boolean }): Promise<NotifyResult> {
  return sendMessage(
    `💳 اشتراک تازه${input.trial ? ' (دوره‌ی آزمایشی)' : ''}\n${input.email}\nتا ${date(input.periodEnd)}`,
  )
}

/** A family asked Stripe to cancel at the end of the current period. */
export async function notifyCancelScheduled(input: { email: string; endsAt: string | null }): Promise<NotifyResult> {
  return sendMessage(`↩️ لغو اشتراک درخواست شد\n${input.email}\nپایان دسترسی: ${date(input.endsAt)}`)
}

/** A subscription ended (cancelled, or dunning gave up) — the account is back on free. */
export async function notifySubscriptionEnded(input: { email: string }): Promise<NotifyResult> {
  return sendMessage(`🔚 اشتراک تمام شد — حساب به پلن رایگان برگشت\n${input.email}`)
}

/** A renewal or first charge failed; Stripe will retry on its own schedule. */
export async function notifyPaymentFailed(input: {
  email: string
  amountCents: number | null
  currency: string | null
  attempt: number | null
}): Promise<NotifyResult> {
  const amount = input.amountCents != null
    ? `${(input.amountCents / 100).toFixed(2)} ${(input.currency ?? '').toUpperCase()}`
    : '—'
  return sendMessage(
    `⚠️ پرداخت ناموفق\n${input.email}\nمبلغ: ${amount}${input.attempt ? ` · تلاش ${input.attempt}` : ''}`,
  )
}

// ── Reliability ────────────────────────────────────────────

/** A request ended in a 500. Throttled per route + message, at most one
 *  message per 15 minutes each, so one broken endpoint can't flood the chat. */
export async function notifyServerError(input: { method: string; path: string; message: string }): Promise<NotifyResult> {
  // Normalise ids out of the path so /stories/<uuid> errors share one key.
  const route = input.path.split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
  const msg = oneLine(input.message, 200)
  return sendThrottled(`error:${input.method} ${route} | ${msg.slice(0, 80)}`, 15,
    `🚨 خطای سرور (500)\n${input.method} ${route}\n${msg}`)
}

/** The process is about to die (uncaught exception / unhandled rejection),
 *  or failed to start (a migration failed). */
export async function notifyCrash(input: { kind: string; message: string }): Promise<NotifyResult> {
  const msg = oneLine(input.message, 400)
  return sendThrottled(`crash:${input.kind} | ${msg.slice(0, 80)}`, 15, `💥 بک‌اند از کار افتاد (${input.kind})\n${msg}`)
}

/** The backend came up (a deploy or a restart). At most one per 10 minutes,
 *  so a crash loop shows up as "+N restarts" instead of N messages. */
export async function notifyStartup(input: { version: string; migrations: string[] }): Promise<NotifyResult> {
  const lines = [`🚀 بک‌اند اجرا شد · نسخه ${input.version}`]
  const m = input.migrations
  if (m.length) {
    const shown = m.slice(-5).join('، ')
    lines.push(`مایگریشن‌های تازه (${m.length}): ${m.length > 5 ? '…، ' : ''}${shown}`)
  }
  return sendThrottled('startup', 10, lines.join('\n'), 'اجرای دیگر از پیام قبلی — اگر زیاد است، بک‌اند مدام ری‌استارت می‌شود')
}

/** AI story generation failed for a reason other than "not configured" —
 *  usually the provider is down, out of credit, or the key was revoked. */
export async function notifyAiFailure(input: { feature: string; message: string }): Promise<NotifyResult> {
  const msg = oneLine(input.message, 250)
  return sendThrottled(`ai:${input.feature}`, 30, `🤖 خطای هوش مصنوعی (${input.feature})\n${msg}`)
}

// ── Mobile app releases (routes/appReleases.ts) ────────────

export async function notifyAppReleasePublished(input: { versionName: string; versionCode: number; url: string }): Promise<NotifyResult> {
  return sendMessage(
    `📱 نسخه‌ی تازه‌ی اپ اندروید منتشر شد\n${input.versionName} (کد ${input.versionCode})\n${input.url}\nپیش‌نویس معرفی در صف تأیید تلگرام است.`,
  )
}
