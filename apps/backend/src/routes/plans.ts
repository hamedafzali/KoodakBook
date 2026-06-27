import { Router } from 'express'
import { query } from '../lib/db'
import { requireAuth } from '../middleware/auth'

const router = Router()

// Customer-facing plan catalogue (active plans + their feature values) for the
// in-app plans/upgrade page. Admin management lives under /api/admin/plans.
router.get('/', requireAuth, async (_req, res) => {
  const plans = await query<{ id: string; key: string }>(
    `select id, key, name, description, price_cents, currency, interval
       from plans where is_active = true order by sort, price_cents`,
  )
  const feats = await query<{ plan_id: string; feature_key: string; value: string }>(
    'select plan_id, feature_key, value from plan_features',
  )
  const byPlan = new Map<string, Record<string, string>>()
  for (const f of feats) {
    const o = byPlan.get(f.plan_id) ?? {}; o[f.feature_key] = f.value; byPlan.set(f.plan_id, o)
  }
  res.json({ data: plans.map(p => ({ ...p, features: byPlan.get(p.id) ?? {} })), error: null })
})

export default router
