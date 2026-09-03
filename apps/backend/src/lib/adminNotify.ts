/**
 * Private admin Telegram DMs — pings the operator's own chat about events
 * worth knowing about right away: new signups, lead/contact submissions, and
 * so on. No channel, no approval step, no queue: this is a direct heads-up,
 * not content publishing.
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
 */

const TG_BASE = process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org'
const TG_TOKEN = process.env.ADMIN_TELEGRAM_BOT_TOKEN ?? ''
const TG_CHAT = process.env.ADMIN_TELEGRAM_CHAT_ID ?? ''

export type NotifyResult = 'sent' | 'dry-run' | 'error'

async function sendMessage(text: string): Promise<NotifyResult> {
  if (!TG_TOKEN || !TG_CHAT) {
    console.log(`[admin-notify] DRY RUN → admin\n  ${text.replace(/\n/g, '\n  ')}`)
    return 'dry-run'
  }
  try {
    const r = await fetch(`${TG_BASE}/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text }),
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
