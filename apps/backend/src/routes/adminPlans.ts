import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { logAudit } from '../lib/audit'

const router = Router()

// ── List plans + features + subscriber counts (any admin) ──
router.get('/plans', requireAdmin, async (_req, res) => {
  const plans = await query<{ id: string; key: string }>(
    `select id, key, name, description, price_cents, currency, interval, trial_days,
            is_active, is_default, sort,
            (select count(*)::int from users u where u.plan = plans.key) as subscribers
     from plans order by sort, price_cents`,
  )
  const feats = await query<{ plan_id: string; feature_key: string; value: string }>(
    'select plan_id, feature_key, value from plan_features',
  )
  const byPlan = new Map<string, Record<string, string>>()
  for (const f of feats) { const o = byPlan.get(f.plan_id) ?? {}; o[f.feature_key] = f.value; byPlan.set(f.plan_id, o) }
  res.json({ data: plans.map(p => ({ ...p, features: byPlan.get(p.id) ?? {} })), error: null })
})

const planSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price_cents: z.number().int().min(0).default(0),
  currency: z.string().default('EUR'),
  interval: z.enum(['month', 'year', 'none']).default('month'),
  trial_days: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
  sort: z.number().int().default(0),
  features: z.record(z.string(), z.string()).default({}),
})

async function writeFeatures(planId: string, features: Record<string, string>) {
  await query('delete from plan_features where plan_id = $1', [planId])
  for (const [k, v] of Object.entries(features)) {
    await query('insert into plan_features (plan_id, feature_key, value) values ($1,$2,$3)', [planId, k, v])
  }
}

router.post('/plans', requireAdmin, requirePermission('plans.manage'), async (req, res) => {
  const parsed = planSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }
  const p = parsed.data
  const existing = await queryOne('select id from plans where key = $1', [p.key])
  if (existing) { res.status(409).json({ data: null, error: 'Plan key already exists' }); return }
  const [row] = await query<{ id: string }>(
    `insert into plans (key,name,description,price_cents,currency,interval,trial_days,is_active,is_default,sort)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [p.key, p.name, p.description ?? null, p.price_cents, p.currency, p.interval, p.trial_days, p.is_active, p.is_default, p.sort],
  )
  if (p.is_default) await query('update plans set is_default = false where id <> $1', [row.id])
  await writeFeatures(row.id, p.features)
  await logAudit(res.locals.adminEmail, 'plan.create', null, row.id, { key: p.key })
  res.json({ data: { id: row.id }, error: null })
})

router.patch('/plans/:id', requireAdmin, requirePermission('plans.manage'), async (req, res) => {
  const parsed = planSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }
  const p = parsed.data
  const row = await queryOne<{ id: string }>(
    `update plans set
       name = coalesce($1,name), description = coalesce($2,description),
       price_cents = coalesce($3,price_cents), currency = coalesce($4,currency),
       interval = coalesce($5,interval), trial_days = coalesce($6,trial_days),
       is_active = coalesce($7,is_active), is_default = coalesce($8,is_default), sort = coalesce($9,sort)
     where id = $10 returning id`,
    [p.name ?? null, p.description ?? null, p.price_cents ?? null, p.currency ?? null, p.interval ?? null,
     p.trial_days ?? null, p.is_active ?? null, p.is_default ?? null, p.sort ?? null, req.params.id],
  )
  if (!row) { res.status(404).json({ data: null, error: 'Plan not found' }); return }
  if (p.is_default) await query('update plans set is_default = false where id <> $1', [req.params.id])
  if (p.features) await writeFeatures(String(req.params.id), p.features)
  await logAudit(res.locals.adminEmail, 'plan.update', null, String(req.params.id), {})
  res.json({ data: { ok: true }, error: null })
})

router.delete('/plans/:id', requireAdmin, requirePermission('plans.manage'), async (req, res) => {
  const plan = await queryOne<{ key: string; is_default: boolean }>('select key, is_default from plans where id = $1', [req.params.id])
  if (!plan) { res.status(404).json({ data: null, error: 'Plan not found' }); return }
  if (plan.is_default) { res.status(400).json({ data: null, error: 'Cannot delete the default plan' }); return }
  const inUse = await queryOne<{ count: string }>('select count(*) from users where plan = $1', [plan.key])
  if (parseInt(inUse?.count ?? '0') > 0) { res.status(400).json({ data: null, error: 'Plan has subscribers; deactivate instead' }); return }
  await query('delete from plans where id = $1', [req.params.id])
  await logAudit(res.locals.adminEmail, 'plan.delete', null, String(req.params.id), { key: plan.key })
  res.json({ data: { ok: true }, error: null })
})

export default router
