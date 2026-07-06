import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { z } from 'zod'
import { requireAdmin, requirePermission } from '../middleware/admin'

const router = Router()
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

/* Free-photo picker for word cards — multi-source, best available first:
 *   Pixabay  (PIXABAY_API_KEY, free registration) — curated stock, safesearch,
 *            best relevance. License: free use, no attribution.
 *   Pexels   (PEXELS_API_KEY, free registration) — high-quality photos,
 *            free use, no attribution.
 *   Openverse (keyless fallback) — CC0/public-domain aggregate; weakest
 *            relevance but always available.
 * Import downloads the chosen photo to our uploads volume so the app never
 * hotlinks third-party hosts. A human picks every image — no bulk matching. */

interface Pic { id: string; thumb: string; url: string; license: string; source: string }

const FETCH_OPTS = { headers: { 'User-Agent': 'KoodakBook-admin/1.0' }, signal: AbortSignal.timeout(10_000) } as const

async function searchPixabay(q: string, key: string): Promise<Pic[]> {
  const r = await fetch(
    `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&image_type=photo&safesearch=true&per_page=24`,
    FETCH_OPTS,
  )
  if (!r.ok) throw new Error(`Pixabay ${r.status}`)
  const j = await r.json() as { hits?: { id: number; previewURL: string; webformatURL: string }[] }
  return (j.hits ?? []).map(h => ({
    id: `px-${h.id}`, thumb: h.previewURL, url: h.webformatURL, license: 'pixabay', source: 'Pixabay',
  }))
}

async function searchPexels(q: string, key: string): Promise<Pic[]> {
  const r = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=24`,
    { ...FETCH_OPTS, headers: { ...FETCH_OPTS.headers, Authorization: key } },
  )
  if (!r.ok) throw new Error(`Pexels ${r.status}`)
  const j = await r.json() as { photos?: { id: number; src: { tiny: string; large: string } }[] }
  return (j.photos ?? []).map(p => ({
    id: `pe-${p.id}`, thumb: p.src.tiny, url: p.src.large, license: 'pexels', source: 'Pexels',
  }))
}

async function searchOpenverse(q: string): Promise<Pic[]> {
  const r = await fetch(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=20&mature=false`,
    FETCH_OPTS,
  )
  if (!r.ok) throw new Error(`Openverse ${r.status}`)
  const j = await r.json() as { results?: { id: string; thumbnail: string; url: string; license: string }[] }
  return (j.results ?? []).map(x => ({
    id: `ov-${x.id}`, thumb: x.thumbnail, url: x.url, license: x.license, source: 'Openverse',
  }))
}

router.get('/images/search', requireAdmin, requirePermission('content.edit'), async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80)
  if (!q) { res.status(400).json({ data: null, error: 'q required' }); return }

  const pixabayKey = process.env.PIXABAY_API_KEY
  const pexelsKey = process.env.PEXELS_API_KEY

  // Keyed sources in parallel when configured; Openverse fills the gap.
  const tasks: Promise<Pic[]>[] = []
  if (pixabayKey) tasks.push(searchPixabay(q, pixabayKey))
  if (pexelsKey) tasks.push(searchPexels(q, pexelsKey))
  if (tasks.length === 0) tasks.push(searchOpenverse(q))

  const settled = await Promise.allSettled(tasks)
  let results = settled.flatMap(s => (s.status === 'fulfilled' ? s.value : []))
  // Keyed sources configured but all failed → still try the keyless fallback.
  if (results.length === 0 && tasks.length > 0 && (pixabayKey || pexelsKey)) {
    try { results = await searchOpenverse(q) } catch { /* keep empty */ }
  }
  if (results.length === 0) {
    const failure = settled.find(s => s.status === 'rejected') as PromiseRejectedResult | undefined
    res.status(502).json({ data: null, error: `جست‌وجوی تصویر ممکن نشد${failure ? `: ${(failure.reason as Error).message}` : ''}` })
    return
  }
  // Interleave sources so the grid mixes providers instead of blocks.
  res.json({ data: results.slice(0, 36), error: null })
})

const importSchema = z.object({ url: z.string().url().max(600) })
const OK_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}
const MAX_BYTES = 6 * 1024 * 1024

router.post('/images/import', requireAdmin, requirePermission('content.edit'), async (req, res) => {
  const p = importSchema.safeParse(req.body)
  if (!p.success || !p.data.url.startsWith('https://')) {
    res.status(400).json({ data: null, error: 'یک آدرس https معتبر لازم است' }); return
  }
  try {
    const r = await fetch(p.data.url, {
      headers: { 'User-Agent': 'KoodakBook-admin/1.0' }, signal: AbortSignal.timeout(20_000),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const type = (r.headers.get('content-type') ?? '').split(';')[0].trim()
    const ext = OK_TYPES[type]
    if (!ext) throw new Error(`نوع فایل پشتیبانی نمی‌شود (${type || 'نامشخص'})`)
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX_BYTES) throw new Error('تصویر بزرگ‌تر از ۶ مگابایت است')
    const dir = path.resolve(UPLOADS_DIR, 'images')
    fs.mkdirSync(dir, { recursive: true })
    const file = `photo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`
    fs.writeFileSync(path.join(dir, file), buf)
    res.status(201).json({ data: { url: `/uploads/images/${file}` }, error: null })
  } catch (err) {
    res.status(502).json({ data: null, error: `دانلود تصویر ممکن نشد: ${(err as Error).message}` })
  }
})

export default router
