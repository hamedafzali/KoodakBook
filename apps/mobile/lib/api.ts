import { createApiClient } from '@koodakbook/shared'
import { router } from 'expo-router'
import { clearActiveChildId } from './activeChild'
import { clearToken, getToken } from './auth'
import { API_BASE } from './config'

export const api = createApiClient({
  baseUrl: API_BASE,
  getToken,
  onSessionRevoked() {
    void clearToken()
    void clearActiveChildId()
    router.replace('/login?expired=1')
  },
})
