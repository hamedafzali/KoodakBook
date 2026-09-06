import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { signParentToken, signChildToken } from '../lib/jwt'
import { clientIp } from '../lib/clientIp'
import { requireAuth, requireParent } from '../middleware/auth'

const router = Router()

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

router.post('/signup', async (req, res) => {
  const parsed = authSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'Invalid email or password' }); return }

  const { email, password } = parsed.data
  const existing = await queryOne('select id from users where email = $1', [email])
  if (existing) { res.status(409).json({ data: null, error: 'Email already registered' }); return }

  const password_hash = await bcrypt.hash(password, 12)
  const [user] = await query<{ id: string }>(
    'insert into users (email, password_hash) values ($1, $2) returning id',
    [email, password_hash]
  )

  const token = signParentToken(user.id)
  res.status(201).json({ data: { token, user_id: user.id }, error: null })
  // Fire-and-forget: a Telegram hiccup must never fail the signup.
  const { notifyNewSignup } = await import('../lib/adminNotify')
  notifyNewSignup({ email }).catch(err => console.error('[admin-notify] notifyNewSignup failed:', err))
})

// ── Kid login: username only ─────────────────────────────
// The child types just their username (parent set it in settings) and lands in
// child mode. No password — kids can't type them; the parent area stays behind
// the PIN. Rate-limited so names can't be enumerated quickly. Future: this is
// the hook point for face recognition.
//
// The issued token is scope: 'child' (signChildToken), NOT the parent's own
// token — it used to be signToken(child.parent_id), meaning guessing a
// username handed out full parent-account access with zero proof of
// identity. A child-scoped token can now only reach that one child's own
// data (middleware/childOwner.ts) and is rejected outright by requireParent
// (PIN set/reset, child-profile management) and requireAdmin.
// Keyed on the real client IP (clientIp), NOT req.ip: behind cloudflared→nginx
// req.ip is nginx's address for every request, so a req.ip bucket would be
// global — one caller could lock out all child logins, and per-attacker
// name-enumeration throttling would be absent. See lib/clientIp.
const kidAttempts = new Map<string, number[]>()
function kidAllowed(ip: string): boolean {
  const now = Date.now()
  const hits = (kidAttempts.get(ip) ?? []).filter(t => now - t < 60_000)
  hits.push(now)
  kidAttempts.set(ip, hits)
  if (kidAttempts.size > 5000) kidAttempts.clear()
  return hits.length <= 10
}

// mig 059: if the parent has set a picture password (children.picture_password),
// a username match alone is no longer enough — this responds with
// needs_picture_password instead of a token, and the client continues with
// /child-login/verify-picture. A child with none set logs straight in, same
// as before (so families that skip setup keep the original one-tap flow).
router.post('/child-login', async (req, res) => {
  if (!kidAllowed(clientIp(req))) {
    res.status(429).json({ data: null, error: 'کمی صبر کن و دوباره امتحان کن' }); return
  }
  const username = String(req.body?.username ?? '').trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    res.status(400).json({ data: null, error: 'اسمت را درست بنویس (حروف انگلیسی)' }); return
  }
  const child = await queryOne<{ id: string; name: string; parent_id: string; picture_password: string[] | null }>(
    'select id, name, parent_id, picture_password from children where lower(username) = $1', [username])
  if (!child) { res.status(404).json({ data: null, error: 'این اسم را پیدا نکردم! از مامان یا بابا بپرس' }); return }

  if (child.picture_password) {
    res.json({ data: { child_id: child.id, child_name: child.name, needs_picture_password: true }, error: null })
    return
  }
  const token = signChildToken(child.parent_id, child.id)
  res.json({ data: { token, child_id: child.id, child_name: child.name }, error: null })
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PICTURE_LOCK_THRESHOLD = 5
const PICTURE_LOCK_MINUTES = 15

function hashDeviceToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// Step 2 of picture-password login. A correct sequence alone is only enough
// on a device already bound to this child (device_token matches a live row
// in device_tokens) — that's the "stolen/found device" defense (mig 059
// header). No match → needs_parent_pin, and the client falls through to
// /child-login/bind-device with the account's actual PIN.
const verifyPictureSchema = z.object({
  child_id: z.string().regex(UUID_RE),
  slugs: z.array(z.string().min(1)).length(3),
  device_token: z.string().min(32).optional(),
})
router.post('/child-login/verify-picture', async (req, res) => {
  if (!kidAllowed(clientIp(req))) {
    res.status(429).json({ data: null, error: 'کمی صبر کن و دوباره امتحان کن' }); return
  }
  const parsed = verifyPictureSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'Invalid request' }); return }
  const { child_id, slugs, device_token } = parsed.data

  const child = await queryOne<{
    id: string; name: string; parent_id: string; picture_password: string[] | null
    picture_failed_attempts: number; picture_locked_until: string | null
  }>(
    'select id, name, parent_id, picture_password, picture_failed_attempts, picture_locked_until from children where id = $1',
    [child_id]
  )
  if (!child?.picture_password) { res.status(404).json({ data: null, error: 'Not found' }); return }

  if (child.picture_locked_until && new Date(child.picture_locked_until) > new Date()) {
    res.json({ data: { ok: false, locked: true }, error: null }); return
  }

  const matches = child.picture_password.length === slugs.length
    && child.picture_password.every((s, i) => s === slugs[i])
  if (!matches) {
    const attempts = child.picture_failed_attempts + 1
    const lock = attempts >= PICTURE_LOCK_THRESHOLD
    await query('update children set picture_failed_attempts = $1, picture_locked_until = $2 where id = $3',
      [lock ? 0 : attempts, lock ? new Date(Date.now() + PICTURE_LOCK_MINUTES * 60_000) : null, child_id])
    res.json({ data: { ok: false, locked: lock }, error: null })
    return
  }
  await query('update children set picture_failed_attempts = 0, picture_locked_until = null where id = $1', [child_id])

  if (device_token) {
    const bound = await queryOne(
      'select 1 from device_tokens where child_id = $1 and token_hash = $2 and revoked_at is null',
      [child_id, hashDeviceToken(device_token)]
    )
    if (bound) {
      await query('update device_tokens set last_used_at = now() where child_id = $1 and token_hash = $2',
        [child_id, hashDeviceToken(device_token)])
      const token = signChildToken(child.parent_id, child.id)
      res.json({ data: { ok: true, token, child_id: child.id, child_name: child.name }, error: null })
      return
    }
  }
  // Right sequence, but this device isn't bound to this child yet.
  res.json({ data: { ok: true, needs_parent_pin: true, child_id: child.id, child_name: child.name }, error: null })
})

// Step 3, only reached on an unbound device: the account's real PIN proves a
// parent is present, and binds this device to the child going forward so
// this step is a one-time cost per (child, device) pair. Uses the SAME
// lockout counters as /pin/verify (users.pin_failed_attempts) — this is
// still an attempt to prove the parent PIN, whichever screen asked for it.
const bindDeviceSchema = z.object({
  child_id: z.string().regex(UUID_RE),
  pin: z.string().regex(/^\d{4}$/),
})
router.post('/child-login/bind-device', async (req, res) => {
  if (!kidAllowed(clientIp(req))) {
    res.status(429).json({ data: null, error: 'کمی صبر کن و دوباره امتحان کن' }); return
  }
  const parsed = bindDeviceSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'Invalid request' }); return }
  const { child_id, pin } = parsed.data

  const child = await queryOne<{ id: string; name: string; parent_id: string }>(
    'select id, name, parent_id from children where id = $1', [child_id])
  if (!child) { res.status(404).json({ data: null, error: 'Not found' }); return }

  const user = await queryOne<{ parent_pin_hash: string | null; pin_failed_attempts: number; pin_locked_until: string | null }>(
    'select parent_pin_hash, pin_failed_attempts, pin_locked_until from users where id = $1', [child.parent_id])
  if (!user?.parent_pin_hash) { res.status(400).json({ data: null, error: 'No PIN set' }); return }

  if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
    res.json({ data: { ok: false, locked: true }, error: null }); return
  }

  if (!(await bcrypt.compare(pin, user.parent_pin_hash))) {
    const attempts = user.pin_failed_attempts + 1
    const lock = attempts >= LOCK_THRESHOLD
    await query('update users set pin_failed_attempts = $1, pin_locked_until = $2 where id = $3',
      [lock ? 0 : attempts, lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null, child.parent_id])
    res.json({ data: { ok: false, locked: lock }, error: null })
    return
  }
  await query('update users set pin_failed_attempts = 0, pin_locked_until = null where id = $1', [child.parent_id])

  const rawDeviceToken = crypto.randomBytes(32).toString('hex')
  await query('insert into device_tokens (child_id, token_hash) values ($1, $2)',
    [child_id, hashDeviceToken(rawDeviceToken)])

  const token = signChildToken(child.parent_id, child.id)
  res.json({ data: { ok: true, token, device_token: rawDeviceToken, child_id: child.id, child_name: child.name }, error: null })
})

router.post('/login', async (req, res) => {
  const parsed = authSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'Invalid email or password' }); return }

  const { email, password } = parsed.data
  const user = await queryOne<{ id: string; password_hash: string; status: string }>(
    'select id, password_hash, status from users where email = $1',
    [email]
  )

  if (user?.status === 'suspended') {
    res.status(403).json({ data: null, error: 'This account is suspended' })
    return
  }
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ data: null, error: 'Invalid email or password' })
    return
  }

  const token = signParentToken(user.id)
  res.json({ data: { token, user_id: user.id }, error: null })
})

router.post('/logout', requireAuth, (_req, res) => {
  // JWT is stateless — client drops the token
  res.json({ data: { ok: true }, error: null })
})

// Current account incl. plan — clients use this to gate premium UI, and `has_pin`
// to decide whether the parent gate should set a new PIN or ask for the existing.
router.get('/me', requireAuth, async (_req, res) => {
  const user = await queryOne<{ id: string; email: string; plan: string; plan_expires_at: string | null; parent_pin_hash: string | null }>(
    'select id, email, plan, plan_expires_at, parent_pin_hash from users where id = $1',
    [res.locals.userId]
  )
  if (!user) { res.status(404).json({ data: null, error: 'Not found' }); return }
  const { parent_pin_hash, ...rest } = user
  res.json({ data: { ...rest, has_pin: !!parent_pin_hash }, error: null })
})

// ── Parent PIN (account-bound) ───────────────────────────────────────────────
// The PIN is a *local lock on the parent area only* — never a login. Wrong-PIN /
// wrong-password use 422/200(ok:false), never 401, so they don't trip the
// client's "session revoked → log out" handler (which is 401-only).
const pinSchema = z.object({ pin: z.string().regex(/^\d{4}$/) })
const LOCK_THRESHOLD = 5
const LOCK_MINUTES = 15

// First-run set. Refuses if a PIN already exists (use reset to change).
// requireParent: a kid-login session proves nothing about identity — it must
// not be able to install the PIN that then unlocks the parent area.
router.post('/pin/set', requireAuth, requireParent, async (req, res) => {
  const parsed = pinSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'PIN must be 4 digits' }); return }

  const user = await queryOne<{ parent_pin_hash: string | null }>(
    'select parent_pin_hash from users where id = $1', [res.locals.userId])
  if (!user) { res.status(404).json({ data: null, error: 'Not found' }); return }
  if (user.parent_pin_hash) { res.status(409).json({ data: null, error: 'PIN already set' }); return }

  const hash = await bcrypt.hash(parsed.data.pin, 10)
  await query('update users set parent_pin_hash = $1, pin_failed_attempts = 0, pin_locked_until = null where id = $2',
    [hash, res.locals.userId])
  res.json({ data: { ok: true }, error: null })
})

// Verify. Always 200; the body says whether it matched / is locked.
// Deliberately requireAuth only, NOT requireParent — this is the intended
// escalation path: a device stuck on a kid-login session (e.g. a shared
// tablet a child opened) proves it's actually the parent by knowing the
// PIN, same as any other device. What a kid-login session can't do is
// INSTALL or CLEAR a PIN without that proof (see pin/set, pin/reset).
router.post('/pin/verify', requireAuth, async (req, res) => {
  const parsed = pinSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'PIN must be 4 digits' }); return }

  const user = await queryOne<{ parent_pin_hash: string | null; pin_failed_attempts: number; pin_locked_until: string | null }>(
    'select parent_pin_hash, pin_failed_attempts, pin_locked_until from users where id = $1', [res.locals.userId])
  if (!user?.parent_pin_hash) { res.status(400).json({ data: null, error: 'No PIN set' }); return }

  if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
    res.json({ data: { ok: false, locked: true }, error: null }); return
  }

  if (await bcrypt.compare(parsed.data.pin, user.parent_pin_hash)) {
    await query('update users set pin_failed_attempts = 0, pin_locked_until = null where id = $1', [res.locals.userId])
    res.json({ data: { ok: true }, error: null }); return
  }

  const attempts = user.pin_failed_attempts + 1
  const lock = attempts >= LOCK_THRESHOLD
  await query('update users set pin_failed_attempts = $1, pin_locked_until = $2 where id = $3',
    [lock ? 0 : attempts, lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null, res.locals.userId])
  res.json({ data: { ok: false, locked: lock }, error: null })
})

// Forgot PIN → clear it with the account password (a child can't bypass it).
// After this the account has no PIN, so the gate falls back to first-run set.
// requireParent too: a kid-login session that somehow learned the account
// password should still go through a real /login, not clear the PIN from
// inside a spoofable-scope session.
const resetSchema = z.object({ password: z.string().min(6) })
router.post('/pin/reset', requireAuth, requireParent, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'Password required' }); return }

  const user = await queryOne<{ password_hash: string }>(
    'select password_hash from users where id = $1', [res.locals.userId])
  if (!user) { res.status(404).json({ data: null, error: 'Not found' }); return }
  if (!(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    res.status(422).json({ data: null, error: 'Incorrect password' }); return
  }
  await query('update users set parent_pin_hash = null, pin_failed_attempts = 0, pin_locked_until = null where id = $1',
    [res.locals.userId])
  res.json({ data: { ok: true }, error: null })
})

export default router
