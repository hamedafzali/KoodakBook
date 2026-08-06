import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { signToken } from '../lib/jwt'
import { clientIp } from '../lib/clientIp'
import { requireAuth } from '../middleware/auth'

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

  const token = signToken(user.id)
  res.status(201).json({ data: { token, user_id: user.id }, error: null })
})

// ── Kid login: username only ─────────────────────────────
// The child types just their username (parent set it in settings) and lands in
// child mode. No password — kids can't type them; the parent area stays behind
// the PIN. Rate-limited so names can't be enumerated quickly. Future: this is
// the hook point for face recognition.
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

router.post('/child-login', async (req, res) => {
  if (!kidAllowed(clientIp(req))) {
    res.status(429).json({ data: null, error: 'کمی صبر کن و دوباره امتحان کن' }); return
  }
  const username = String(req.body?.username ?? '').trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    res.status(400).json({ data: null, error: 'اسمت را درست بنویس (حروف انگلیسی)' }); return
  }
  const child = await queryOne<{ id: string; name: string; parent_id: string }>(
    'select id, name, parent_id from children where lower(username) = $1', [username])
  if (!child) { res.status(404).json({ data: null, error: 'این اسم را پیدا نکردم! از مامان یا بابا بپرس' }); return }
  const token = signToken(child.parent_id)
  res.json({ data: { token, child_id: child.id, child_name: child.name }, error: null })
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

  const token = signToken(user.id)
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
router.post('/pin/set', requireAuth, async (req, res) => {
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
const resetSchema = z.object({ password: z.string().min(6) })
router.post('/pin/reset', requireAuth, async (req, res) => {
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
