import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '../lib/db'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { logAudit } from '../lib/audit'
import { asyncHandler } from '../lib/asyncHandler'

const router = Router()
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@koodakbook.com'

// ── Roles + their permissions ────────────────────────────
router.get('/roles', requireAdmin, requirePermission('admin.manage'), async (_req, res) => {
  const roles = await query<{ id: string; key: string; name: string; description: string | null }>(
    'select id, key, name, description from roles order by key',
  )
  const perms = await query<{ role_id: string; permission_key: string }>(
    'select role_id, permission_key from role_permissions',
  )
  const byRole = new Map<string, string[]>()
  for (const p of perms) { const a = byRole.get(p.role_id) ?? []; a.push(p.permission_key); byRole.set(p.role_id, a) }
  res.json({ data: roles.map(r => ({ ...r, permissions: byRole.get(r.id) ?? [] })), error: null })
})

router.get('/permissions', requireAdmin, requirePermission('admin.manage'), async (_req, res) => {
  const rows = await query('select key, description from permissions order by key')
  res.json({ data: rows, error: null })
})

// ── Admin team (users holding ≥1 role, plus the env owner) ──
router.get('/admins', requireAdmin, requirePermission('admin.manage'), async (_req, res) => {
  const rows = await query<{ id: string; email: string; created_at: string; roles: string[] | null }>(
    `select u.id, u.email, u.created_at,
       array_remove(array_agg(r.key), null) as roles
     from users u
     join user_roles ur on ur.user_id = u.id
     join roles r on r.id = ur.role_id
     where u.email <> $1
     group by u.id, u.email, u.created_at
     order by u.created_at`,
    [ADMIN_EMAIL],
  )
  res.json({ data: { owner_email: ADMIN_EMAIL, admins: rows }, error: null })
})

// ── Create an admin (new account + roles), returns a temp password ──
const createSchema = z.object({
  email: z.string().email(),
  roles: z.array(z.string()).min(1),
})
router.post('/admins', requireAdmin, requirePermission('admin.manage'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }
  const { email, roles } = parsed.data

  let user = await queryOne<{ id: string }>('select id from users where email = $1', [email])
  let temp: string | null = null
  if (!user) {
    temp = 'kb-' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10)
    const hash = await bcrypt.hash(temp, 12)
    user = (await query<{ id: string }>('insert into users (email, password_hash) values ($1,$2) returning id', [email, hash]))[0]
  }
  await setRoles(user.id, roles)
  await logAudit(res.locals.adminEmail, 'admin.create', 'user', user.id, { email, roles })
  res.json({ data: { id: user.id, email, roles, temp_password: temp }, error: null })
})

// ── Set an admin's roles ─────────────────────────────────
const rolesSchema = z.object({ roles: z.array(z.string()) })
router.patch('/admins/:id/roles', requireAdmin, requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const parsed = rolesSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }
  const u = await queryOne<{ email: string }>('select email from users where id = $1', [req.params.id])
  if (!u) { res.status(404).json({ data: null, error: 'User not found' }); return }
  if (u.email === ADMIN_EMAIL) { res.status(400).json({ data: null, error: 'Cannot change the owner account' }); return }
  await setRoles(String(req.params.id), parsed.data.roles)
  await logAudit(res.locals.adminEmail, 'admin.set_roles', 'user', String(req.params.id), { roles: parsed.data.roles })
  res.json({ data: { ok: true }, error: null })
}))

// ── Revoke admin access (remove all roles; keep the account) ──
router.delete('/admins/:id', requireAdmin, requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const u = await queryOne<{ email: string }>('select email from users where id = $1', [req.params.id])
  if (!u) { res.status(404).json({ data: null, error: 'User not found' }); return }
  if (u.email === ADMIN_EMAIL) { res.status(400).json({ data: null, error: 'Cannot revoke the owner account' }); return }
  await query('delete from user_roles where user_id = $1', [req.params.id])
  await logAudit(res.locals.adminEmail, 'admin.revoke', 'user', String(req.params.id), { email: u.email })
  res.json({ data: { ok: true }, error: null })
}))

async function setRoles(userId: string, roleKeys: string[]) {
  await query('delete from user_roles where user_id = $1', [userId])
  if (roleKeys.length === 0) return
  await query(
    `insert into user_roles (user_id, role_id)
     select $1, r.id from roles r where r.key = any($2)
     on conflict do nothing`,
    [userId, roleKeys],
  )
}

export default router
