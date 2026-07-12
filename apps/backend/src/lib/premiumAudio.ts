import { queryOne } from './db'
import { isPremiumActive } from '@koodakbook/shared'

/* Premium audio resolution, shared by every route that serves content audio.
 * Paid accounts get audio_url_premium transparently promoted into audio_url —
 * the apps never know two variants exist. */

/** Policy (product review 2026-07): audio QUALITY is not a paid tier.
 * Catalog clips are pre-generated files — serving the best variant to every
 * account has zero marginal cost, and voice quality is core to learning and
 * trust. Per-use costs (AI story narration) are gated by usage caps instead.
 * Flip to false only if the strategy reverts. */
export const AUDIO_QUALITY_FOR_ALL = true

export async function userIsPremium(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const u = await queryOne<{ plan: string; plan_expires_at: string | null }>(
    'select plan, plan_expires_at from users where id = $1', [userId])
  return isPremiumActive(u?.plan, u?.plan_expires_at)
}

/** Promote the premium variant in place (recurses into nested content objects). */
export function promoteAudio<T>(obj: T, premium: boolean): T {
  if (!premium || !obj || typeof obj !== 'object') return obj
  const o = obj as Record<string, unknown>
  if (typeof o.audio_url_premium === 'string' && o.audio_url_premium) o.audio_url = o.audio_url_premium
  for (const k of ['word', 'letter', 'example_word']) if (o[k]) promoteAudio(o[k], premium)
  if (Array.isArray(o.words)) for (const w of o.words) promoteAudio((w as Record<string, unknown>)?.word, premium)
  return obj
}
