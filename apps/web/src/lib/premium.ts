import { api } from './api'
import { isLoggedIn } from './auth'
import { isPremiumActive } from '@koodakbook/shared'

/* Client-side premium flag for fixed-path audio (phonics/math packs).
 * DB-backed content gets its premium audio_url promoted SERVER-side; only
 * client-built paths (/uploads/phonics/<slug>.wav, /uploads/math/…) need the
 * client to know the plan. Fetched once per session, defaults to free. */

let premium = false
let started = false

export function ensurePremiumFlag(): void {
  if (started || !isLoggedIn()) return
  started = true
  api.get<{ plan?: string; plan_expires_at?: string | null }>('/api/auth/me').then(r => {
    premium = isPremiumActive(r.data?.plan, r.data?.plan_expires_at)
  }).catch(() => { /* stay free */ })
}

export function isPremiumClient(): boolean {
  ensurePremiumFlag()
  return premium
}

/** Playback candidates for a fixed-path clip: premium variant first (when the
 *  account is paid), then the free file — the player falls through on 404. */
export function audioCandidates(url: string): string[] {
  return isPremiumClient() ? [url.replace('/uploads/', '/uploads/premium/'), url] : [url]
}
