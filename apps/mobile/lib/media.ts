import { PixelRatio } from 'react-native'
import { API_BASE } from './config'

// Upload URLs come from the API as relative paths (/uploads/...). Web proxies
// them through Next.js; here they must be absolutized against the backend.
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

// Widths the web app's image optimizer accepts by default (Next.js
// imageSizes ∪ deviceSizes). Any other width is refused.
const OPTIMIZER_WIDTHS = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920]

/**
 * A resized copy of an uploaded image shown at about `dp` points. The word
 * and story art is stored as large PNGs (1024×1024, ~0.7 MB each); this goes
 * through the web app's image optimizer (/_next/image on the same site as the
 * API in release builds) at the screen's pixel density, so a quiz downloads a
 * few KB per picture instead of ~0.7 MB.
 *
 * Only when the API base is the public https site: a development build that
 * points at a bare backend (http://…:4000) has no /_next, so it gets the
 * original file.
 */
export function thumbUrl(url: string | null | undefined, dp: number): string | null {
  if (!url) return null
  if (url.startsWith('http') || !url.startsWith('/uploads/') || !API_BASE.startsWith('https://')) return mediaUrl(url)
  const want = Math.ceil(dp * Math.min(PixelRatio.get(), 3))
  const w = OPTIMIZER_WIDTHS.find(x => x >= want) ?? OPTIMIZER_WIDTHS[OPTIMIZER_WIDTHS.length - 1]
  return `${API_BASE}/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=75`
}
