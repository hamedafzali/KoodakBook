import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { asyncHandler } from '../lib/asyncHandler'
import { clientIp } from '../lib/clientIp'
import { verifyToken } from '../lib/jwt'
import { requireAuth, requireParent } from '../middleware/auth'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { logAudit } from '../lib/audit'
import { notifyNewFeedback } from '../lib/adminNotify'

/* Family feedback (migration 068).
 *
 *   POST  /api/feedback                 the website contact form (no account)
 *                                       and the parent area (signed in)
 *   GET   /api/feedback/mine            a parent's own messages + our replies
 *   POST  /api/feedback/mine/seen       mark replies as read
 *   GET   /api/admin/feedback           the inbox (users.read)
 *   PATCH /api/admin/feedback/:id       status / internal note / reply
 *
 * A signed-in parent's message is tied to their account (and their account
 * email); a kid-login token is ignored — a child can't reach these screens,
 * and a guessed username must not be able to write as the family. */

export const FEEDBACK_KINDS = ['idea', 'problem', 'question', 'other'] as const
export const FEEDBACK_STATUSES = ['new', 'in_progress', 'answered', 'closed'] as const
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const router = Router()
export const adminFeedbackRouter = Router()

const submitSchema = z.object({
  source: z.enum(['site', 'parent_web', 'parent_mobile']).default('site'),
  kind: z.enum(FEEDBACK_KINDS).default('other'),
  message: z.string().trim().min(5, 'پیام خیلی کوتاه است').max(2000, 'پیام خیلی بلند است'),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email('ایمیل درست نیست').max(200).optional(),
  // Free-form but small and flat: screen, platform, app version, browser.
  context: z.record(z.union([z.string().max(300), z.number(), z.boolean()])).optional()
    .refine(c => !c || Object.keys(c).length <= 12, 'context too large'),
  website: z.string().max(200).optional(),   // honeypot, same as /api/leads
})

// Per-client burst limit, keyed on the real client IP (lib/clientIp), like
// routes/leads.ts: 5 messages a minute is plenty for a person.
const recent = new Map<string, number[]>()
function allow(key: string): boolean {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter(t => now - t < 60_000)
  hits.push(now)
  recent.set(key, hits)
  if (recent.size > 5000) recent.clear()
  return hits.length <= 5
}

/** The signed-in parent, if the request carries a valid parent token for an
 *  active account; otherwise null (a public visitor). Never throws. */
async function optionalParent(authorization: string | undefined): Promise<{ id: string; email: string } | null> {
  const token = authorization?.replace('Bearer ', '')
  if (!token) return null
  try {
    const payload = verifyToken(token)
    if (payload.scope !== 'parent') return null
    return await queryOne<{ id: string; email: string }>(
      `select id, email from users where id = $1 and status = 'active'`, [payload.sub])
  } catch {
    return null
  }
}

router.post('/', asyncHandler(async (req, res) => {
  const p = submitSchema.safeParse(req.body)
  if (!p.success) {
    res.status(400).json({ data: null, error: p.error.issues[0]?.message ?? 'اطلاعات فرم کامل نیست' }); return
  }
  if (p.data.website) { res.status(201).json({ data: { ok: true }, error: null }); return }   // honeypot
  const parent = await optionalParent(req.headers.authorization)
  if (!allow(parent ? `u:${parent.id}` : `ip:${clientIp(req)}`)) {
    res.status(429).json({ data: null, error: 'کمی بعد دوباره بفرستید' }); return
  }
  const email = parent?.email ?? p.data.email
  if (!email) { res.status(400).json({ data: null, error: 'ایمیل لازم است تا بتوانیم جواب بدهیم' }); return }
  // Only signed-in parents can claim a parent-area source.
  const source = parent ? (p.data.source === 'site' ? 'parent_web' : p.data.source) : 'site'

  const row = await queryOne<{ id: string }>(
    `insert into feedback (user_id, source, kind, name, email, message, context)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [parent?.id ?? null, source, p.data.kind, p.data.name || null, email, p.data.message, JSON.stringify(p.data.context ?? {})],
  )
  res.status(201).json({ data: { ok: true, id: row!.id }, error: null })
  notifyNewFeedback({
    kind: p.data.kind, source, email, name: p.data.name ?? null, message: p.data.message,
    signedIn: !!parent, screen: typeof p.data.context?.screen === 'string' ? p.data.context.screen : null,
  }).catch(() => {})
}))

interface MineRow {
  id: string; kind: string; message: string; status: string; reply: string | null
  replied_at: string | null; reply_seen_at: string | null; created_at: string
}

router.get('/mine', requireAuth, requireParent, asyncHandler(async (_req, res) => {
  const rows = await query<MineRow>(
    `select id, kind, message, status, reply, replied_at, reply_seen_at, created_at
       from feedback where user_id = $1 order by created_at desc limit 50`,
    [res.locals.userId],
  )
  const unread = rows.filter(r => r.reply && !r.reply_seen_at).length
  res.json({ data: { items: rows, unread }, error: null })
}))

router.post('/mine/seen', requireAuth, requireParent, asyncHandler(async (_req, res) => {
  await query(
    `update feedback set reply_seen_at = now()
      where user_id = $1 and reply is not null and reply_seen_at is null`,
    [res.locals.userId],
  )
  res.json({ data: { ok: true }, error: null })
}))

// ── Admin ──────────────────────────────────────────────────

adminFeedbackRouter.get('/feedback', requireAdmin, requirePermission('users.read'), asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' && (FEEDBACK_STATUSES as readonly string[]).includes(req.query.status)
    ? req.query.status : null
  const kind = typeof req.query.kind === 'string' && (FEEDBACK_KINDS as readonly string[]).includes(req.query.kind)
    ? req.query.kind : null
  const q = typeof req.query.q === 'string' && req.query.q.trim() ? `%${req.query.q.trim()}%` : null
  const [rows, counts] = await Promise.all([
    query(
      `select f.*, u.plan as user_plan,
              (select count(*) from children c where c.parent_id = f.user_id)::int as children
         from feedback f left join users u on u.id = f.user_id
        where ($1::text is null or f.status = $1)
          and ($2::text is null or f.kind = $2)
          and ($3::text is null or f.message ilike $3 or f.email ilike $3 or coalesce(f.name, '') ilike $3)
        order by (f.status = 'new') desc, f.created_at desc
        limit 300`,
      [status, kind, q],
    ),
    query<{ status: string; n: string }>(`select status, count(*) as n from feedback group by status`),
  ])
  res.json({
    data: { items: rows, counts: Object.fromEntries(counts.map(c => [c.status, Number(c.n)])) },
    error: null,
  })
}))

const patchSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  admin_note: z.string().trim().max(2000).nullable().optional(),
  reply: z.string().trim().min(1).max(2000).optional(),
})

adminFeedbackRouter.patch('/feedback/:id', requireAdmin, requirePermission('users.read'), asyncHandler(async (req, res) => {
  if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ data: null, error: 'id must be a uuid' }); return }
  const p = patchSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.issues[0]?.message ?? 'invalid' }); return }
  const cur = await queryOne<{ id: string; user_id: string | null }>('select id, user_id from feedback where id = $1', [req.params.id])
  if (!cur) { res.status(404).json({ data: null, error: 'not found' }); return }
  if (p.data.reply && !cur.user_id) {
    res.status(409).json({ data: null, error: 'این پیام از سایت آمده و حساب ندارد — با ایمیل جواب بدهید' }); return
  }
  const sets: string[] = ['updated_at = now()']
  const vals: unknown[] = [req.params.id]
  const set = (sql: string, v: unknown) => { vals.push(v); sets.push(sql.replace('?', `$${vals.length}`)) }
  if (p.data.admin_note !== undefined) set('admin_note = ?', p.data.admin_note || null)
  if (p.data.reply) {
    set('reply = ?', p.data.reply)
    set('replied_by = ?', res.locals.adminEmail ?? null)
    sets.push('replied_at = now()', 'reply_seen_at = null')
    // Answering moves it to "answered" unless an explicit status came along.
    if (!p.data.status) sets.push(`status = 'answered'`)
  }
  if (p.data.status) set('status = ?', p.data.status)
  const row = await queryOne(`update feedback set ${sets.join(', ')} where id = $1 returning *`, vals)
  await logAudit(res.locals.adminEmail, p.data.reply ? 'feedback.reply' : 'feedback.update', 'feedback', cur.id,
    { status: p.data.status ?? null, replied: !!p.data.reply, noted: p.data.admin_note !== undefined })
  res.json({ data: row, error: null })
}))

export default router
