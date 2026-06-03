import { ApiResponse } from '@koodakbook/shared'
import { getToken } from './auth'

// Relative base: Next.js rewrites /api/* → backend, so no host needed
const BASE = ''

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
    })
    try {
      return await res.json()
    } catch {
      return { data: null, error: 'پاسخ نامعتبر از سرور' }
    }
  } catch {
    return { data: null, error: 'اتصال به سرور برقرار نشد' }
  }
}

export const api = {
  get:    <T>(path: string)                => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)               => request<T>(path, { method: 'DELETE' }),
}
