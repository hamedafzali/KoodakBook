import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'
import { queryOne } from '../lib/db'
import { isAdminUser, loadPermissions, hasPermission } from '../lib/permissions'

/**
 * Admin gate (RBAC, mig-023): allows the env owner OR any user holding ≥1 role.
 * Loads the caller's effective permissions into res.locals for requirePermission.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ data: null, error: 'Unauthorized' }); return }

  try {
    const payload = verifyToken(token)
    // A kid-login token carries the parent's account id but proves nothing
    // about identity — never let one into the admin panel even if that
    // parent happens to be an admin/owner.
    if (payload.scope === 'child') { res.status(403).json({ data: null, error: 'Forbidden' }); return }
    const user = await queryOne<{ email: string }>('select email from users where id = $1', [payload.sub])
    if (!user) { res.status(403).json({ data: null, error: 'Forbidden' }); return }
    if (!(await isAdminUser(payload.sub, user.email))) {
      res.status(403).json({ data: null, error: 'Forbidden' }); return
    }
    res.locals.userId = payload.sub
    res.locals.adminEmail = user.email
    res.locals.adminPermissions = await loadPermissions(payload.sub, user.email)
    next()
  } catch {
    res.status(401).json({ data: null, error: 'Invalid token' })
  }
}

/** Gate a route on a specific permission. Must run after requireAdmin. */
export function requirePermission(perm: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!hasPermission(res.locals.adminPermissions, perm)) {
      res.status(403).json({ data: null, error: `Permission denied: ${perm}` }); return
    }
    next()
  }
}
