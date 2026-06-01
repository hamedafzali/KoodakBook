import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ data: null, error: 'Unauthorized' })
    return
  }

  try {
    const payload = verifyToken(token)
    res.locals.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ data: null, error: 'Invalid or expired token' })
  }
}
