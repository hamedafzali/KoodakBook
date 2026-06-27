import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'

const router = Router()

const createChildSchema = z.object({
  name: z.string().trim().min(1, 'نام لازم است').max(40, 'نام خیلی بلند است'),
  birth_year: z.number().int().min(2010).max(2025).nullable().optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(1),
  avatar_url: z.string().url().nullable().optional(),
})

router.get('/', requireAuth, async (_req, res) => {
  const userId = res.locals.userId
  const rows = await query(
    'select * from children where parent_id = $1 order by created_at',
    [userId]
  )
  res.json({ data: rows, error: null })
})

router.post('/', requireAuth, async (req, res) => {
  const userId = res.locals.userId
  const parsed = createChildSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }

  // Enforce the account's plan child limit (free = 1, premium = 5) server-side —
  // the catalog value alone never stopped a second profile from being created.
  const limitRow = await queryOne<{ value: string }>(
    `select pf.value from users u
       join plans p on p.key = u.plan
       join plan_features pf on pf.plan_id = p.id and pf.feature_key = 'max_children'
      where u.id = $1`, [userId])
  const maxChildren = parseInt(limitRow?.value ?? '1', 10) || 1
  const countRow = await queryOne<{ n: number }>(
    'select count(*)::int as n from children where parent_id = $1', [userId])
  if ((countRow?.n ?? 0) >= maxChildren) {
    res.status(403).json({
      data: null,
      error: `در پلن فعلی حداکثر ${maxChildren} پروفایل کودک می‌توانید بسازید. برای کودک بیشتر، پلن را ارتقا دهید.`,
    })
    return
  }

  const { name, birth_year, level, avatar_url } = parsed.data
  const [child] = await query(
    `insert into children (parent_id, name, birth_year, level, avatar_url)
     values ($1, $2, $3, $4, $5) returning *`,
    [userId, name, birth_year ?? null, level, avatar_url ?? null]
  )
  res.status(201).json({ data: child, error: null })
})

router.patch('/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId
  const parsed = createChildSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }

  const { name, birth_year, level, avatar_url } = parsed.data
  const child = await queryOne(
    `update children set
       name        = coalesce($1, name),
       birth_year  = coalesce($2, birth_year),
       level       = coalesce($3, level),
       avatar_url  = coalesce($4, avatar_url)
     where id = $5 and parent_id = $6
     returning *`,
    [name ?? null, birth_year ?? null, level ?? null, avatar_url ?? null, req.params.id, userId]
  )
  if (!child) { res.status(404).json({ data: null, error: 'Child not found' }); return }
  res.json({ data: child, error: null })
})

export default router
