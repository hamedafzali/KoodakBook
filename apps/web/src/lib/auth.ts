const TOKEN_KEY        = 'koodakbook_token'
const LEGACY_PIN_KEY   = 'koodakbook_parent_pin'      // pre-026 device-local PIN — purge it
const ACTIVE_CHILD_KEY = 'koodakbook_active_child'
const UNLOCK_KEY       = 'koodakbook_parent_unlocked' // sessionStorage: parent area unlocked for this tab

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * A new account is taking over this device (login or signup). Set its token and
 * drop anything scoped to whoever was here before — the legacy device PIN, the
 * active-child selection, and the parent-unlock flag — so nothing bleeds across.
 */
export function onSignIn(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.removeItem(LEGACY_PIN_KEY)
  localStorage.removeItem(ACTIVE_CHILD_KEY)
  try { sessionStorage.removeItem(UNLOCK_KEY) } catch { /* sessionStorage unavailable */ }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(LEGACY_PIN_KEY)
  localStorage.removeItem(ACTIVE_CHILD_KEY)
  try { sessionStorage.removeItem(UNLOCK_KEY) } catch { /* sessionStorage unavailable */ }
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
