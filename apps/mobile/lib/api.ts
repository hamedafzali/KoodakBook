import { createApiClient } from '@koodakbook/shared'
import { router } from 'expo-router'
import { clearActiveChildId } from './activeChild'
import { clearToken, getToken } from './auth'
import { API_BASE } from './config'
import { setParentUnlocked } from './parentGate'

// Home fires ~8 requests at once; when the session is revoked every one of
// them comes back 401 and each used to call router.replace('/login'), a burst
// of navigations. One redirect per burst is enough.
let redirecting = false

export const api = createApiClient({
  baseUrl: API_BASE,
  getToken,
  onSessionRevoked() {
    // A dead session must not leave the in-memory parent unlock behind for
    // whoever signs in next in this app process.
    setParentUnlocked(false)
    void clearToken()
    void clearActiveChildId()
    if (redirecting) return
    redirecting = true
    router.replace('/login?expired=1')
    setTimeout(() => { redirecting = false }, 2000)
  },
})
