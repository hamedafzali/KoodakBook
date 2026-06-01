import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'

const router = Router()

const createChildSchema = z.object({
  name: z.string().min(1),
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
