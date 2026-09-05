import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET!
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '30d'

if (!SECRET) throw new Error('Missing JWT_SECRET')

export interface TokenPayload {
  sub: string
  // 'parent' = full account access (email+password login, or a parent who
  // has proven the PIN). 'child' = kid-login (username only, no proof of
  // identity) — carries the SAME account id (sub) as its parent, so it must
  // never be trusted for anything a stranger who merely guessed a username
  // shouldn't get: setting/resetting the parent PIN, managing child
  // profiles, admin access. See middleware/auth.ts's requireParent and
  // middleware/childOwner.ts.
  scope: 'parent' | 'child'
  childId?: string
}

export function signParentToken(userId: string): string {
  return jwt.sign({ sub: userId, scope: 'parent' }, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions)
}

/** Kid-login token: same account (sub) as the parent, scoped to one child. */
export function signChildToken(parentId: string, childId: string): string {
  return jwt.sign({ sub: parentId, scope: 'child', childId }, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions)
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, SECRET) as { sub: string; scope?: string; childId?: string }
  // Tokens issued before this scope existed carry no `scope` claim — the
  // only kind of token that could exist then was a full parent session, so
  // default a missing claim to 'parent'. New tokens always set it
  // explicitly (signChildToken always does), so this default can never mask
  // a genuine child token as a parent one.
  return {
    sub: decoded.sub,
    scope: decoded.scope === 'child' ? 'child' : 'parent',
    childId: decoded.childId,
  }
}
