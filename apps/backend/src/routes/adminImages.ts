import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { z } from 'zod'
import { requireAdmin, requirePermission } from '../middleware/admin'

const router = Router()
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

/* Free-photo picker for word cards.
 * Search proxies Openverse (openly-licensed image aggregator; keyless public
 * API) filtered to CC0/public-domain only — no attribution burden in a kids'
 * product. Import downloads the chosen photo to our uploads volume so the app
 * never hotlinks third-party hosts (privacy, speed, availability). A human
 * picks every image — no blind bulk matching. */

router.get('/images/search', requireAdmin, requirePermission('content.edit'), async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80)
  if (!q) { res.status(400).json({ data: null, error: 'q required' }); return }
  try {
    const r = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=8&mature=false`,
      { headers: { 'User-Agent': 'KoodakBook-admin/1.0' }, signal: AbortSignal.timeout(10_000) },
    )
    if (!r.ok) throw new Error(`Openverse ${r.status}`)
    const json = await r.json() as { results?: { id: string; thumbnail: string; url: string; title?: string; license: string; source?: string }[] }
    const results = (json.results ?? []).map(x => ({
      id: x.id, thumb: x.thumbnail, url: x.url,
      title: x.title ?? '', license: x.license, source: x.source ?? '',
    }))
    res.json({ data: results, error: null })
  } catch (err) {
    res.status(502).json({ data: null, error: `جست‌وجوی تصویر ممکن نشد: ${(err as Error).message}` })
  }
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
