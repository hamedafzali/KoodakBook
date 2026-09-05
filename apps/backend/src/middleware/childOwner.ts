import { Request, Response, NextFunction } from 'express'
import { queryOne } from '../lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ensure the child referenced by the request belongs to the authenticated parent.
 * Reads child_id from the route params or the JSON body. Must run after
 * requireAuth (which sets res.locals.userId). Fails closed.
 *
 * A kid-login session (res.locals.scope === 'child') is additionally locked
 * to its OWN child_id — the token's sub is the shared parent account, so
 * without this a kid-login for one sibling could read/write another
 * sibling's progress, badges, or story chats just by passing their id.
 */
export async function requireChildOwner(req: Request, res: Response, next: NextFunction) {
  const childId = (req.params.child_id ?? req.body?.child_id) as string | undefined
  if (!childId || !UUID_RE.test(childId)) {
    res.status(400).json({ data: null, error: 'Valid child_id required' })
    return
  }
  if (res.locals.scope === 'child' && res.locals.childId !== childId) {
    res.status(403).json({ data: null, error: 'Forbidden' })
    return
  }
  try {
    const owned = await queryOne(
      'select 1 from children where id = $1 and parent_id = $2',
      [childId, res.locals.userId]
    )
    if (!owned) {
      res.status(403).json({ data: null, error: 'Forbidden' })
      return
    }
    next()
  } catch {
    res.status(403).json({ data: null, error: 'Forbidden' })
  }
}
