import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { signToken } from '../lib/jwt'
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

router.post('/login', async (req, res) => {
  const parsed = authSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'Invalid email or password' }); return }

  const { email, password } = parsed.data
  const user = await queryOne<{ id: string; password_hash: string }>(
    'select id, password_hash from users where email = $1',
    [email]
  )

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

// Current account incl. plan — clients use this to gate premium UI.
router.get('/me', requireAuth, async (_req, res) => {
  const user = await queryOne(
    'select id, email, plan, plan_expires_at from users where id = $1',
    [res.locals.userId]
  )
  if (!user) { res.status(404).json({ data: null, error: 'Not found' }); return }
  res.json({ data: user, error: null })
})

export default router
