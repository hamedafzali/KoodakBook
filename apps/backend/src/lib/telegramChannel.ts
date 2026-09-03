/**
 * Public Telegram channel posting — sends to @koodakbook_app via Telegram's
 * sendMessage, plain fetch (no SDK dependency).
 *
 * Same shape as the weekly parent digest (lib/digest.ts): if TELEGRAM_BOT_TOKEN
 * is not set it does a DRY RUN — the message is logged instead of sent, so the
 * whole pipeline is testable before you have a bot. To go live:
 *   TELEGRAM_BOT_TOKEN=...   TELEGRAM_CHANNEL=@koodakbook_app
 * (the bot must be added to the channel as an admin with post permission).
 *
 * This is a separate bot/token from ALERT_TELEGRAM_BOT_TOKEN (lib/alerts) and
 * ADMIN_TELEGRAM_BOT_TOKEN (lib/adminNotify) — this is the only one of the
 * three with public posting rights. Keeping them separate means a broken or
 * leaked content-bot token can never grant post access to the channel from
 * a private context, or vice versa.
 *
 * postToChannel() only SENDS — it never decides whether something should be
 * posted. That decision belongs to the approval queue (routes/adminPostDrafts.ts,
 * docs/telegram-approval-queue.md); this module has no direct callers outside
 * that queue's review endpoint. render*Message() functions here stay pure so a
 * draft's exact text can be composed and shown to a reviewer before anything
 * is sent.
 */

const TG_BASE = process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org'
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const TG_CHANNEL = process.env.TELEGRAM_CHANNEL ?? '@koodakbook_app'
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000'

export type PostResult = 'sent' | 'dry-run' | 'error'

interface NewStory {
  title_persian: string
  title_english: string
  stage: number
}

export function renderNewStoryMessage(s: NewStory): string {
  return (
    `📖 داستان تازه در کودک‌بوک منتشر شد!\n\n` +
    `«${s.title_persian}» (${s.title_english})\n` +
    `مرحله ${s.stage}\n\n` +
    `${WEB_URL}`
  )
}

/** Send arbitrary, already-approved text to the public channel. The only
 *  function in this file that talks to Telegram — see the approval-queue
 *  note above for why nothing else should call it directly. */
export async function postToChannel(text: string): Promise<PostResult> {
  if (!TG_TOKEN) {
    console.log(`[telegram] DRY RUN → ${TG_CHANNEL}\n  ${text.replace(/\n/g, '\n  ')}`)
    return 'dry-run'
  }
  try {
    const r = await fetch(`${TG_BASE}/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHANNEL, text }),
    })
    if (!r.ok) {
      console.error(`[telegram] sendMessage error ${r.status} for ${TG_CHANNEL}: ${await r.text()}`)
      return 'error'
    }
    return 'sent'
  } catch (err) {
    console.error(`[telegram] send failed for ${TG_CHANNEL}:`, err)
    return 'error'
  }
}
