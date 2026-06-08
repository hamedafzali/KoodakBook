import { Request, Response, NextFunction } from 'express'
import { queryOne } from '../lib/db'
import { isPremiumActive } from '@koodakbook/shared'

/**
 * Gate a route behind an active premium plan. Run after requireAuth.
 * Ready for premium features (coaching, analytics, culture packs, offline, …);
 * not yet attached to any route — billing sets users.plan = 'premium'.
 */
export async function requirePremium(_req: Request, res: Response, next: NextFunction) {
  const user = await queryOne<{ plan: string; plan_expires_at: string | null }>(
    'select plan, plan_expires_at from users where id = $1',
    [res.locals.userId]
  )
  if (!user || !isPremiumActive(user.plan, user.plan_expires_at)) {
    res.status(402).json({ data: null, error: 'Premium required' })
    return
  }
  next()
}
