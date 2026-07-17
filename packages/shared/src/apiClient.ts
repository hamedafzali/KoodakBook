import { ApiResponse } from './types'

/**
 * Platform-neutral API client shared by web and mobile. Each platform injects
 * the pieces that differ: where the JWT lives (localStorage vs SecureStore),
 * what "go to login" means (redirect vs navigation reset), and the base URL
 * (web uses '' because Next.js rewrites /api/* to the backend; mobile must
 * point at the backend host directly).
 */
export interface ApiClientConfig {
  /** Prefixed to every path. '' on web (Next rewrites), absolute URL on mobile. */
  baseUrl: string
  /** Read the stored JWT. May be async (SecureStore) or sync (localStorage). */
  getToken: () => string | null | Promise<string | null>
  /**
   * Called when a token we *sent* came back rejected (401) — the account was
   * deleted or suspended, or the token expired. JWTs are stateless, so this is
   * the only place the UI learns the session is dead: clear the token and
   * bounce to login so a removed family can't keep using a cached session.
   * (A 403 is a forbidden resource and must NOT trigger this.)
   */
  onSessionRevoked: () => void
}

export interface ApiClient {
  get: <T>(path: string) => Promise<ApiResponse<T>>
  post: <T>(path: string, body: unknown) => Promise<ApiResponse<T>>
  patch: <T>(path: string, body: unknown) => Promise<ApiResponse<T>>
  delete: <T>(path: string) => Promise<ApiResponse<T>>
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const token = await config.getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch(`${config.baseUrl}${path}`, {
        ...options,
        headers: { ...headers, ...((options?.headers as Record<string, string>) ?? {}) },
      })
      if (token && res.status === 401) config.onSessionRevoked()
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

  return {
    get:    <T>(path: string)                => request<T>(path, { method: 'GET' }),
    post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
    patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }),
  }
}
