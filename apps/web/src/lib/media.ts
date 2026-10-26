// Upload URLs are relative paths (/uploads/...) — proxied through Next.js
// to the backend. Absolute URLs (http://...) are passed through unchanged.
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url
}

// Widths Next.js's image optimizer accepts by default (imageSizes ∪
// deviceSizes). A request for any other width is refused.
const OPTIMIZER_WIDTHS = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920]

/**
 * A resized copy of an uploaded image, for a plain <img> shown at about
 * `cssPx` CSS pixels. The word and story art is stored as large PNGs
 * (1024×1024, ~0.7 MB each); this asks Next.js's optimizer (/_next/image,
 * the same one next/image uses) for a small WebP at 2× the display size, so a
 * quiz with four pictures downloads a few KB instead of ~3 MB. Anything that
 * isn't a local /uploads path is returned unchanged.
 */
export function thumbUrl(url: string | null | undefined, cssPx: number): string | null {
  const src = mediaUrl(url)
  if (!src || !src.startsWith('/uploads/')) return src
  const want = Math.ceil(cssPx * 2)
  const w = OPTIMIZER_WIDTHS.find(x => x >= want) ?? OPTIMIZER_WIDTHS[OPTIMIZER_WIDTHS.length - 1]
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`
}
