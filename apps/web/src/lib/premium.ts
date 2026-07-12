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
  if (started || typeof window === 'undefined' || !isLoggedIn()) return
  started = true
  // Last known answer applies instantly (fresh page loads would otherwise play
  // the free voice on the first tap while /me is still in flight)…
  try { premium = sessionStorage.getItem('kb_premium') === '1' } catch { /* private mode */ }
  // …then refresh from the server.
  api.get<{ plan?: string; plan_expires_at?: string | null }>('/api/auth/me').then(r => {
    premium = isPremiumActive(r.data?.plan, r.data?.plan_expires_at)
    try { sessionStorage.setItem('kb_premium', premium ? '1' : '0') } catch { /* ignore */ }
  }).catch(() => { /* keep cached value */ })
}

export function isPremiumClient(): boolean {
  ensurePremiumFlag()
  return premium
}

/** Playback candidates for a fixed-path clip. Policy: audio quality is not a
 *  paid tier — EVERY account tries the premium variant first and falls
 *  through (404) to the free file, then browser TTS. */
export function audioCandidates(url: string): string[] {
  return [url.replace('/uploads/', '/uploads/premium/'), url]
}
