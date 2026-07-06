import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAdmin, requirePermission } from '../middleware/admin'

const router = Router()

// Public lead form (marketing site): tablet pre-orders, app waitlist, contact.
// The `website` field is a honeypot — real users never fill it; bots do, and
// we accept-and-drop so they can't tell.
const leadSchema = z.object({
  type: z.enum(['tablet', 'app_waitlist', 'contact']),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  message: z.string().trim().max(2000).optional(),
  website: z.string().max(200).optional(),   // honeypot
})

// Tiny in-memory rate limit — the form is low-traffic; this just blunts bursts.
const recent = new Map<string, number[]>()
function allow(ip: string): boolean {
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter(t => now - t < 60_000)
  hits.push(now)
  recent.set(ip, hits)
  if (recent.size > 5000) recent.clear()   // don't grow unbounded
  return hits.length <= 5
}

router.post('/', async (req, res) => {
  const p = leadSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: 'اطلاعات فرم کامل نیست' }); return }
  if (p.data.website) { res.json({ data: { ok: true }, error: null }); return }   // honeypot hit
  if (!allow(req.ip ?? 'unknown')) { res.status(429).json({ data: null, error: 'کمی بعد دوباره تلاش کنید' }); return }
  const { type, name, email, phone, country, quantity, message } = p.data
  await query(
    'insert into leads (type, name, email, phone, country, quantity, message) values ($1,$2,$3,$4,$5,$6,$7)',
    [type, name ?? null, email, phone ?? null, country ?? null, quantity ?? null, message ?? null],
  )
  res.status(201).json({ data: { ok: true }, error: null })
})

// ── Admin: review + work the queue ────────────────────────
router.get('/admin/list', requireAdmin, requirePermission('users.read'), async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : null
  const rows = await query(
    `select * from leads where ($1::text is null or type = $1)
      order by (status = 'new') desc, created_at desc limit 500`,
    [type],
  )
  res.json({ data: rows, error: null })
})

router.patch('/admin/:id', requireAdmin, requirePermission('users.read'), async (req, res) => {
  const status = req.body?.status
  if (!['new', 'contacted', 'closed'].includes(status)) { res.status(400).json({ data: null, error: 'Invalid status' }); return }
  const row = await queryOne('update leads set status = $1 where id = $2 returning *', [status, req.params.id])
  res.json({ data: row, error: null })
})

export default router
