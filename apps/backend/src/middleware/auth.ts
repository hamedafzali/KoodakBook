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
  try {
    userId = verifyToken(token).sub
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
  next()
}
