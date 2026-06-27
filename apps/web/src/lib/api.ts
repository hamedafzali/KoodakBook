import { ApiResponse } from '@koodakbook/shared'
import { getToken, clearToken } from './auth'

// Relative base: Next.js rewrites /api/* → backend, so no host needed
const BASE = ''

/**
 * A token we *sent* came back rejected (401) — the account was deleted or
 * suspended, or the token expired. JWTs are stateless, so the only way the UI
 * learns the session is dead is here: drop the token and bounce to /login so a
 * removed family can't keep using a cached session after refresh.
 */
function sessionRevoked() {
  clearToken()
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
    })
    // Only when we actually presented a token: a 401 then means the session is
    // no longer valid (a 403 is a forbidden resource and must NOT log out).
    if (token && res.status === 401) sessionRevoked()
    try {
      return await res.json()
    } catch {
      // Non-JSON response (e.g. 502 HTML page)
      return { data: null, error: 'اتصال برقرار نشد. دوباره تلاش کن' }
    }
  } catch {
    // Network failure / offline — never let the promise reject
    return { data: null, error: 'اینترنت قطع است. دوباره تلاش کن' }
  }
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)   => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
}
