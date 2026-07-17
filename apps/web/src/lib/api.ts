import { createApiClient } from '@koodakbook/shared'
import { getToken, clearToken } from './auth'

export const api = createApiClient({
  // Relative base: Next.js rewrites /api/* → backend, so no host needed
  baseUrl: '',
  getToken,
  onSessionRevoked() {
    clearToken()
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      // ?expired=1 lets the login screen explain the bounce ("your session ended")
      // instead of silently dumping the user there mid-task.
      window.location.href = '/login?expired=1'
    }
  },
})
