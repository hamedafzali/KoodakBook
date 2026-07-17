import { API_BASE } from './config'

// Upload URLs come from the API as relative paths (/uploads/...). Web proxies
// them through Next.js; here they must be absolutized against the backend.
// file:// URLs (offline-downloaded assets) pass through untouched.
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('http') || url.startsWith('file:') ? url : `${API_BASE}${url}`
}
