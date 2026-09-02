/**
 * Public Telegram channel announcements — posts real content milestones to
 * @koodakbook_app via Telegram's sendMessage, plain fetch (no SDK dependency).
 *
 * Same shape as the weekly parent digest (lib/digest.ts): if TELEGRAM_BOT_TOKEN
 * is not set it does a DRY RUN — the message is logged instead of sent, so the
 * whole pipeline is testable before you have a bot. To go live:
 *   TELEGRAM_BOT_TOKEN=...   TELEGRAM_CHANNEL=@koodakbook_app
 * (the bot must be added to the channel as an admin with post permission).
 *
 * This is a separate bot/token from ALERT_TELEGRAM_BOT_TOKEN (lib/alerts) —
 * that one DMs a private ops chat about job failures; this one posts publicly
 * to the channel about new content. Keeping them separate means a broken
 * content bot can never end up with post access to internal alerts, or vice
 * versa.
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

function renderNewStoryMessage(s: NewStory): string {
  return (
    `📖 داستان تازه در کودک‌بوک منتشر شد!\n\n` +
    `«${s.title_persian}» (${s.title_english})\n` +
    `مرحله ${s.stage}\n\n` +
    `${WEB_URL}`
  )
}

async function sendMessage(text: string): Promise<PostResult> {
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

/** Announce a newly published story to the public channel. */
export async function announceNewStory(story: NewStory): Promise<PostResult> {
  return sendMessage(renderNewStoryMessage(story))
}
