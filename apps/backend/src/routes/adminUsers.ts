import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '../lib/db'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { logAudit } from '../lib/audit'

const router = Router()

// Families exclude admin accounts (the owner + anyone holding a role).
const NOT_ADMIN = `u.email <> $5 and not exists (select 1 from user_roles ur where ur.user_id = u.id)`
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@koodakbook.com'

// ── List parents (search + paginate) ─────────────────────
router.get('/users', requireAdmin, requirePermission('users.read'), async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() ?? ''
  const limit = Math.min(parseInt((req.query.limit as string) ?? '50'), 200)
  const offset = Math.max(parseInt((req.query.offset as string) ?? '0'), 0)
  const like = `%${q}%`

  const rows = await query(
    `select u.id, u.email, u.plan, u.plan_expires_at, u.created_at,
       (select count(*)::int from children c where c.parent_id = u.id) as children_count,
       (select max(s.started_at) from child_sessions s
          join children c on c.id = s.child_id where c.parent_id = u.id) as last_active
     from users u
     where ($1 = '' or u.email ilike $2) and ${NOT_ADMIN}
     order by u.created_at desc
     limit $3 offset $4`,
    [q, like, limit, offset, ADMIN_EMAIL],
  )
  const total = await queryOne<{ count: string }>(
    `select count(*) from users u where ($1 = '' or u.email ilike $2) and ${NOT_ADMIN.replace('$5', '$3')}`,
    [q, like, ADMIN_EMAIL],
  )
  res.json({ data: { users: rows, total: parseInt(total?.count ?? '0'), limit, offset }, error: null })
})

// ── Family detail: parent + children + quick stats ───────
router.get('/users/:id', requireAdmin, requirePermission('users.read'), async (req, res) => {
  const user = await queryOne(
    'select id, email, plan, plan_expires_at, created_at from users where id = $1', [req.params.id],
  )
  if (!user) { res.status(404).json({ data: null, error: 'User not found' }); return }

  const children = await query(
    `select c.id, c.name, c.birth_year, c.level, c.placement_done, c.created_at,
       (select count(*)::int from child_word_progress w
          where w.child_id = c.id and w.mastery in ('mastered','consolidated')) as words_mastered,
       (select count(*)::int from child_lesson_progress l where l.child_id = c.id and l.completed) as lessons_done,
       (select count(*)::int from child_story_progress s where s.child_id = c.id and s.completed) as stories_done,
       (select max(started_at) from child_sessions s where s.child_id = c.id) as last_active
     from children c where c.parent_id = $1 order by c.created_at`,
    [req.params.id],
  )
  res.json({ data: { user, children }, error: null })
})

// ── Child drill-down: full learning picture ──────────────
router.get('/children/:id', requireAdmin, requirePermission('users.read'), async (req, res) => {
  const child = await queryOne(
    'select id, parent_id, name, birth_year, level, placement_done, created_at from children where id = $1',
    [req.params.id],
  )
  if (!child) { res.status(404).json({ data: null, error: 'Child not found' }); return }
  const id = req.params.id

  const [mastery, strands, lessons, stories, sessions, badges, history, words] = await Promise.all([
    query(`select mastery, count(*)::int as n from child_word_progress where child_id = $1 group by mastery`, [id]),
    query(`select strand, level, source, updated_at from child_strand_levels where child_id = $1 order by strand`, [id]),
    query(`select lesson_id, completed, score, completed_at from child_lesson_progress where child_id = $1`, [id]),
    query(`select story_id, completed, last_page, replay_count, last_read_at from child_story_progress where child_id = $1`, [id]),
    query(`select started_at, duration_sec from child_sessions where child_id = $1 order by started_at desc limit 20`, [id]),
    query(`select cb.earned_at, b.title, b.key from child_badges cb join badges b on b.id = cb.badge_id where cb.child_id = $1 order by cb.earned_at desc`, [id]),
    query(`select level, strand_levels, taken_at from placement_history where child_id = $1 order by taken_at`, [id]),
    query(`select cwp.mastery, cwp.box_receptive, cwp.due_at, w.persian, w.english
           from child_word_progress cwp join words w on w.id = cwp.word_id
           where cwp.child_id = $1 order by cwp.mastery, w.persian`, [id]),
  ])

  const breakdown = { introduced: 0, practicing: 0, mastered: 0, consolidated: 0 }
  for (const r of mastery as { mastery: keyof typeof breakdown; n: number }[]) {
    if (r.mastery in breakdown) breakdown[r.mastery] = r.n
  }

  res.json({
    data: {
      child,
      mastery_breakdown: breakdown,
      strand_levels: strands,
      lessons_completed: (lessons as { completed: boolean }[]).filter(l => l.completed).length,
      stories_completed: (stories as { completed: boolean }[]).filter(s => s.completed).length,
      lessons, stories,
      recent_sessions: sessions,
      badges,
      placement_history: history,
      words,
    },
    error: null,
  })
})

// ── Change plan / entitlement ────────────────────────────
const planSchema = z.object({
  plan: z.string().min(1),
  plan_expires_at: z.string().datetime().nullable().optional(),
})
router.patch('/users/:id/plan', requireAdmin, requirePermission('users.plan'), async (req, res) => {
  const parsed = planSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }
  const { plan, plan_expires_at } = parsed.data
  // Validate the plan exists (plans system, mig-024).
  const exists = await queryOne('select 1 from plans where key = $1 and is_active', [plan])
  if (!exists) { res.status(400).json({ data: null, error: 'Unknown or inactive plan' }); return }
  const row = await queryOne(
    `update users set plan = $1, plan_expires_at = $2 where id = $3
     returning id, email, plan, plan_expires_at`,
    [plan, plan_expires_at ?? null, req.params.id],
  )
  if (!row) { res.status(404).json({ data: null, error: 'User not found' }); return }
  await logAudit(res.locals.adminEmail, 'user.plan_change', 'user', String(req.params.id), { plan, plan_expires_at: plan_expires_at ?? null })
  res.json({ data: row, error: null })
})

// ── Reset a parent's password (returns a one-time temp password) ──
router.post('/users/:id/reset-password', requireAdmin, requirePermission('users.reset_password'), async (req, res) => {
  const user = await queryOne<{ email: string }>('select email from users where id = $1', [req.params.id])
  if (!user) { res.status(404).json({ data: null, error: 'User not found' }); return }
  // Generate a readable temp password; admin hands it to the parent, who changes it.
  const temp = 'kb-' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10)
  const hash = await bcrypt.hash(temp, 12)
  await query('update users set password_hash = $1 where id = $2', [hash, req.params.id])
  await logAudit(res.locals.adminEmail, 'user.reset_password', 'user', String(req.params.id), { email: user.email })
  res.json({ data: { temp_password: temp }, error: null })
})

// ── Delete a family (cascades to children + all progress) ──
router.delete('/users/:id', requireAdmin, requirePermission('users.delete'), async (req, res) => {
  const user = await queryOne<{ email: string }>('select email from users where id = $1', [req.params.id])
  if (!user) { res.status(404).json({ data: null, error: 'User not found' }); return }
  // Never let an admin delete the admin account out from under itself.
  if (user.email === (process.env.ADMIN_EMAIL ?? '')) {
    res.status(400).json({ data: null, error: 'Cannot delete the admin account' }); return
  }
  await query('delete from users where id = $1', [req.params.id])
  await logAudit(res.locals.adminEmail, 'user.delete', 'user', String(req.params.id), { email: user.email })
  res.json({ data: { ok: true }, error: null })
})

// ── Audit log viewer ─────────────────────────────────────
router.get('/audit', requireAdmin, requirePermission('audit.read'), async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '100'), 500)
  const rows = await query(
    `select admin_email, action, target_type, target_id, detail, created_at
     from audit_log order by created_at desc limit $1`, [limit],
  )
  res.json({ data: rows, error: null })
})

export default router
