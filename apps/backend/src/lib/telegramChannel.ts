/**
 * Public Telegram channel posting — sends to @koodakbook_app via Telegram's
 * sendMessage/sendPhoto, plain fetch (no SDK dependency).
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
 *
 * An optional image (migration 057, post_drafts.image_path) is uploaded to
 * Telegram as raw bytes read off local disk (UPLOADS_DIR), not passed as a
 * URL — sendPhoto's `photo` param accepting a URL would require the app to be
 * publicly reachable there, which WEB_URL currently is not (see
 * docs/telegram-approval-queue.md).
 */
import fs from 'fs'
import path from 'path'

const TG_BASE = process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org'
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const TG_CHANNEL = process.env.TELEGRAM_CHANNEL ?? '@koodakbook_app'
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000'
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

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

/** Resolve a post_drafts.image_path (e.g. "/uploads/images/foo.png") to a
 *  real file under UPLOADS_DIR, refusing anything that tries to escape it. */
function resolveUploadPath(imagePath: string): string | null {
  const rel = imagePath.replace(/^\/?uploads\//, '')
  const abs = path.resolve(UPLOADS_DIR, rel)
  if (!abs.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) return null
  return fs.existsSync(abs) ? abs : null
}

/** Send arbitrary, already-approved text — with an optional local image — to
 *  the public channel. The only function in this file that talks to
 *  Telegram — see the approval-queue note above for why nothing else should
 *  call it directly. Falls back to a text-only sendMessage if imagePath is
 *  missing or the file can't be found on disk. */
export async function postToChannel(text: string, imagePath?: string | null): Promise<PostResult> {
  const filePath = imagePath ? resolveUploadPath(imagePath) : null
  if (imagePath && !filePath) {
    console.error(`[telegram] image_path not found on disk, sending text-only: ${imagePath}`)
  }

  if (!TG_TOKEN) {
    console.log(`[telegram] DRY RUN${filePath ? ` (+ image ${filePath})` : ''} → ${TG_CHANNEL}\n  ${text.replace(/\n/g, '\n  ')}`)
    return 'dry-run'
  }
  try {
    let r: Response
    if (filePath) {
      const form = new FormData()
      form.set('chat_id', TG_CHANNEL)
      form.set('caption', text)
      form.set('photo', new Blob([fs.readFileSync(filePath)]), path.basename(filePath))
      r = await fetch(`${TG_BASE}/bot${TG_TOKEN}/sendPhoto`, { method: 'POST', body: form })
    } else {
      r = await fetch(`${TG_BASE}/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHANNEL, text }),
      })
    }
    if (!r.ok) {
      console.error(`[telegram] send error ${r.status} for ${TG_CHANNEL}: ${await r.text()}`)
      return 'error'
    }
    return 'sent'
  } catch (err) {
    console.error(`[telegram] send failed for ${TG_CHANNEL}:`, err)
    return 'error'
  }
}
