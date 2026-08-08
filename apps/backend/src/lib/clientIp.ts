import type { Request } from 'express'

/**
 * The real client IP for rate-limiting, resolved for our proxy chain:
 *
 *     client → Cloudflare edge → cloudflared → nginx → backend
 *
 * `req.ip` is useless here: `trust proxy` is unset, so it is the socket peer —
 * nginx's container address — which is IDENTICAL for every request. Keying a
 * limiter on it makes the limit GLOBAL (one attacker exhausts the budget and
 * denies everyone), not per-client.
 *
 * Cloudflare stamps the true client IP into `CF-Connecting-IP` at its edge and
 * cloudflared forwards it; the client cannot spoof it (Cloudflare overwrites any
 * value the client sends). nginx passes non-overridden request headers straight
 * through to the upstream, so it reaches us intact. `X-Real-IP` (set by nginx)
 * is only the cloudflared hop, so it is a weak fallback used just for direct/LAN
 * requests that never traversed Cloudflare.
 */
export function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf.length > 0) return cf
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim()
  return req.ip ?? 'unknown'
}
