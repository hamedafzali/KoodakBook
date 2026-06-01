import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@koodakbook.com'

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ data: null, error: 'Unauthorized' }); return }

  try {
    const payload = verifyToken(token)
    const { queryOne } = await import('../lib/db')
    const user = await queryOne<{ email: string }>('select email from users where id = $1', [payload.sub])
    if (!user || user.email !== ADMIN_EMAIL) {
      res.status(403).json({ data: null, error: 'Forbidden' }); return
    }
    res.locals.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ data: null, error: 'Invalid token' })
  }
}
