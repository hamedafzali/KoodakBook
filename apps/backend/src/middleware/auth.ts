import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'
import { queryOne } from '../lib/db'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ data: null, error: 'Unauthorized' })
    return
  }

  let userId: string
  let scope: 'parent' | 'child'
  let childId: string | undefined
  try {
    const payload = verifyToken(token)
    userId = payload.sub
    scope = payload.scope
    childId = payload.childId
  } catch {
    res.status(401).json({ data: null, error: 'Invalid or expired token' })
    return
  }

  // A valid JWT signature is not enough — tokens are stateless and live ~30 days.
  // Confirm the account still exists and is active on every request, so deleting
  // or suspending a family takes effect on their very next request rather than
  // whenever their token happens to expire.
  let user: { status: string } | null
  try {
    user = await queryOne<{ status: string }>('select status from users where id = $1', [userId])
  } catch {
    res.status(503).json({ data: null, error: 'Service unavailable' })
    return
  }
  if (!user) {
    res.status(401).json({ data: null, error: 'Account no longer exists' })
    return
  }
  if (user.status !== 'active') {
    // 401 (not 403) so the client treats it as "session invalid → log out",
    // distinct from a 403 "forbidden resource" which must not end the session.
    res.status(401).json({ data: null, error: 'Account suspended' })
    return
  }

  res.locals.userId = userId
  res.locals.scope = scope
  res.locals.childId = childId
  next()
}

/**
 * Gate for anything a kid-login session must not be able to do even though it
 * shares the parent's account id: setting/resetting the parent PIN, managing
 * child profiles (creating one, renaming, changing a login username), and
 * anything similarly account-level. Run AFTER requireAuth.
 *
 * A device that's in child mode because a *parent* switched it there
 * (lib/mode.ts enterChildMode) is unaffected — that never swaps the token,
 * so its session is still scope: 'parent' and passes straight through.
 */
export function requireParent(_req: Request, res: Response, next: NextFunction) {
  if (res.locals.scope === 'child') {
    res.status(403).json({ data: null, error: 'برای این کار باید با حساب والدین وارد شوید' })
    return
  }
  next()
}
