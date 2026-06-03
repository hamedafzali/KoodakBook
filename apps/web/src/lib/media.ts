// Upload URLs are relative paths (/uploads/...) — proxied through Next.js
// to the backend. Absolute URLs (http://...) are passed through unchanged.
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url
}
