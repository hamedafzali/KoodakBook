import { NextResponse, type NextRequest } from 'next/server'

/**
 * Server-side gate for the private app shell. The real session lives in
 * localStorage (see lib/auth.ts) which this can't read — instead it checks
 * the `kb_session` presence cookie that onSignIn()/clearToken() keep in sync
 * with it. This is intentionally a presence check, not a validity check: an
 * expired/revoked token still carries the cookie until the client notices and
 * calls clearToken(). It exists to stop two things client-side redirects
 * don't: a non-JS crawler indexing the empty auth-shell HTML of these routes,
 * and a logged-out visitor seeing that shell flash before the redirect fires.
 * It is not a replacement for the API's own auth checks — those still gate
 * every actual read/write.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('kb_session')
  if (!hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/child/:path*', '/parent/:path*', '/onboarding/:path*'],
}
