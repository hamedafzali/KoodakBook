const TOKEN_KEY        = 'koodakbook_token'
const LEGACY_PIN_KEY   = 'koodakbook_parent_pin'      // pre-026 device-local PIN — purge it
const ACTIVE_CHILD_KEY = 'koodakbook_active_child'
const UNLOCK_KEY       = 'koodakbook_parent_unlocked' // sessionStorage: parent area unlocked for this tab

// Mirrors "is there a token" into a plain cookie so middleware.ts — which runs
// on the server and can't see localStorage — can gate private routes for
// logged-out visitors and non-JS crawlers. It's a presence flag, not the
// session itself: the real token (and the only thing the backend trusts)
// stays in localStorage. Keeping it in sync is the whole job of onSignIn/
// clearToken below; anything that ends a session MUST go through clearToken,
// not just drop the localStorage key, or the cookie goes stale and middleware
// waves through a session the API would actually reject.
const SESSION_COOKIE = 'kb_session'

function setSessionCookie() {
  if (typeof document === 'undefined') return
  // 30 days, matching the JWT's own rough lifetime is unnecessary — this only
  // ever gates *presence*, so it just needs to outlive a normal browsing gap.
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=2592000; samesite=lax`
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * A new account is taking over this device (login, signup, or kid-login all
 * call this). Set its token and drop anything scoped to whoever was here
 * before — the legacy device PIN, the active-child selection, and the
 * parent-unlock flag — so nothing bleeds across.
 */
export function onSignIn(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.removeItem(LEGACY_PIN_KEY)
  localStorage.removeItem(ACTIVE_CHILD_KEY)
  localStorage.removeItem('koodakbook_mode')   // reset to parent for the new owner
  try { sessionStorage.removeItem(UNLOCK_KEY) } catch { /* sessionStorage unavailable */ }
  setSessionCookie()
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(LEGACY_PIN_KEY)
  localStorage.removeItem(ACTIVE_CHILD_KEY)
  localStorage.removeItem('koodakbook_mode')   // reset to parent for the new owner
  try { sessionStorage.removeItem(UNLOCK_KEY) } catch { /* sessionStorage unavailable */ }
  clearSessionCookie()
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

// Parent-area unlock is per-tab (sessionStorage): once the PIN is entered the
// parent pages don't re-prompt on every navigation/refresh, but it clears when
// the tab closes, on logout, and on account switch.
export function markParentUnlocked() {
  try { sessionStorage.setItem(UNLOCK_KEY, '1') } catch { /* ignore */ }
}
export function isParentUnlocked(): boolean {
  try { return sessionStorage.getItem(UNLOCK_KEY) === '1' } catch { return false }
}
export function lockParent() {
  try { sessionStorage.removeItem(UNLOCK_KEY) } catch { /* ignore */ }
}
