import { Router, raw } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { asyncHandler } from '../lib/asyncHandler'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { logAudit } from '../lib/audit'
import { isMp4Head } from '../lib/videoFile'

/* Children's videos (migration 070) — the «ویدیوها» menu in the app and on
 * the website. Every published video is free for every child.
 *
 *   GET    /api/videos                          public — published videos by category
 *
 *   GET    /api/admin/videos                    all videos + categories (content.read)
 *   POST   /api/admin/videos/upload/start       chunked .mp4 upload, like app releases:
 *   PUT    /api/admin/videos/upload/:id/chunk?offset=N   ≤ 8 MB per request
 *   POST   /api/admin/videos/upload/:id/finish  { size } → { url, bytes }
 *   POST   /api/admin/videos/cover              cover image (multipart "file")
 *   POST   /api/admin/videos                    create (draft)
 *   PATCH  /api/admin/videos/:id                edit, publish / unpublish
 *   DELETE /api/admin/videos/:id                only while unpublished
 *   POST   /api/admin/video-categories          create category
 *   PATCH  /api/admin/video-categories/:id      rename / reorder
 *   DELETE /api/admin/video-categories/:id      only when it has no videos
 *
 * The admin panel's Next.js proxy caps a request at 10 MB / 30 s, which is
 * why video files go up in chunks (same reason as routes/appReleases.ts). */

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos')
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_VIDEO_BYTES = 300 * 1024 * 1024
const CHUNK_MAX = 8 * 1024 * 1024
const PARTIAL_DIR = path.join(os.tmpdir(), 'koodakbook-video-uploads')
const UPLOAD_ID_RE = /^[0-9a-f]{32}$/
const partPath = (id: string) => path.join(PARTIAL_DIR, `${id}.part`)

fs.mkdirSync(VIDEOS_DIR, { recursive: true })
fs.mkdirSync(IMAGES_DIR, { recursive: true })
fs.mkdirSync(PARTIAL_DIR, { recursive: true })
for (const f of fs.readdirSync(PARTIAL_DIR)) {
  const p = path.join(PARTIAL_DIR, f)
  try { if (Date.now() - fs.statSync(p).mtimeMs > 86_400_000) fs.unlinkSync(p) } catch { /* ignore */ }
}

export interface VideoCategory {
  id: string
  slug: string
  title_fa: string
  emoji: string | null
  order_index: number
}

export interface Video {
  id: string
  category_id: string
  title_fa: string
  description_fa: string | null
  video_url: string
  cover_url: string | null
  duration_sec: number | null
  file_bytes: number | null
  order_index: number
  is_published: boolean
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const CAT_COLS = 'id, slug, title_fa, emoji, order_index'
// numeric/bigint come back from node-postgres as strings; cast for the API.
const VIDEO_COLS = `id, category_id, title_fa, description_fa, video_url, cover_url,
  duration_sec::float8 as duration_sec, file_bytes::float8 as file_bytes, order_index,
  is_published, published_at, created_by, created_at, updated_at`

// ── Public ─────────────────────────────────────────────────

const publicRouter = Router()

publicRouter.get('/', asyncHandler(async (_req, res) => {
  const videos = await query<Video>(
    `select ${VIDEO_COLS} from videos
      where is_published
      order by order_index, published_at`,
  )
  const used = new Set(videos.map(v => v.category_id))
  const categories = (await query<VideoCategory>(
    `select ${CAT_COLS} from video_categories order by order_index, title_fa`,
  )).filter(c => used.has(c.id))
  res.set('Cache-Control', 'public, max-age=60')
  res.json({
    data: {
      categories,
      videos: videos.map(v => ({
        id: v.id, category_id: v.category_id, title_fa: v.title_fa, description_fa: v.description_fa,
        video_url: v.video_url, cover_url: v.cover_url, duration_sec: v.duration_sec,
      })),
    },
    error: null,
  })
}))

// ── Admin ──────────────────────────────────────────────────

export const adminVideosRouter = Router()

adminVideosRouter.get('/videos', requireAdmin, requirePermission('content.read'),
  asyncHandler(async (_req, res) => {
    const [categories, videos] = await Promise.all([
      query<VideoCategory>(`select ${CAT_COLS} from video_categories order by order_index, title_fa`),
      query<Video>(`select ${VIDEO_COLS} from videos order by order_index, created_at`),
    ])
    res.json({ data: { categories, videos }, error: null })
  }))

// Chunked upload of the .mp4 itself.
adminVideosRouter.post('/videos/upload/start', requireAdmin, requirePermission('content.edit'),
  asyncHandler(async (_req, res) => {
    const id = crypto.randomBytes(16).toString('hex')
    fs.writeFileSync(partPath(id), Buffer.alloc(0))
    res.json({ data: { upload_id: id, chunk_size: CHUNK_MAX }, error: null })
  }))

adminVideosRouter.put('/videos/upload/:id/chunk', requireAdmin, requirePermission('content.edit'),
  raw({ type: () => true, limit: CHUNK_MAX + 1024 }), asyncHandler(async (req, res) => {
    const id = String(req.params.id)
    if (!UPLOAD_ID_RE.test(id) || !fs.existsSync(partPath(id))) {
      res.status(404).json({ data: null, error: 'upload not found' }); return
    }
    const offset = Number(req.query.offset)
    const body = req.body as Buffer
    if (!Buffer.isBuffer(body) || body.length === 0) { res.status(400).json({ data: null, error: 'empty chunk' }); return }
    const size = fs.statSync(partPath(id)).size
    if (!Number.isInteger(offset) || offset !== size) {
      res.status(409).json({ data: { size }, error: `offset must be ${size}` }); return
    }
    if (size + body.length > MAX_VIDEO_BYTES) { res.status(413).json({ data: null, error: 'فایل خیلی بزرگ است (حداکثر ۳۰۰ مگابایت)' }); return }
    fs.appendFileSync(partPath(id), body)
    res.json({ data: { size: size + body.length }, error: null })
  }))

adminVideosRouter.post('/videos/upload/:id/finish', requireAdmin, requirePermission('content.edit'),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)
    if (!UPLOAD_ID_RE.test(id) || !fs.existsSync(partPath(id))) {
      res.status(404).json({ data: null, error: 'upload not found' }); return
    }
    const size = fs.statSync(partPath(id)).size
    if (Number(req.body?.size) !== size || size === 0) {
      res.status(409).json({ data: { size }, error: `فایل کامل نرسید (${size} از ${req.body?.size} بایت)` }); return
    }
    const head = Buffer.alloc(12)
    const fd = fs.openSync(partPath(id), 'r'); fs.readSync(fd, head, 0, 12, 0); fs.closeSync(fd)
    if (!isMp4Head(head)) {
      fs.unlinkSync(partPath(id))
      res.status(400).json({ data: null, error: 'این فایل MP4 نیست' }); return
    }
    const filename = `video-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp4`
    // Copy, not rename: temp dir and the uploads volume differ in Docker.
    await new Promise<void>((resolve, reject) => {
      const src = fs.createReadStream(partPath(id))
      const dst = fs.createWriteStream(path.join(VIDEOS_DIR, filename))
      src.on('error', reject)
      dst.on('error', reject).on('finish', () => resolve())
      src.pipe(dst)
    })
    fs.unlinkSync(partPath(id))
    res.json({ data: { url: `/uploads/videos/${filename}`, bytes: size }, error: null })
  }))

const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
      cb(null, `videocover-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /\.(png|jpe?g|webp)$/i.test(file.originalname)),
})

adminVideosRouter.post('/videos/cover', requireAdmin, requirePermission('content.edit'),
  coverUpload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) { res.status(400).json({ data: null, error: 'یک تصویر png، jpg یا webp بفرستید' }); return }
    res.status(201).json({ data: { url: `/uploads/images/${req.file.filename}` }, error: null })
  }))

const videoUrl = z.string().trim().refine(
  u => /^\/uploads\/videos\/[\w.-]+\.mp4$/.test(u) || /^https:\/\/\S+$/.test(u),
  'video_url must be an /uploads/videos/ path or an https URL',
)
const coverUrl = z.string().trim().refine(
  u => /^\/uploads\/images\/[\w.-]+$/.test(u) || /^https:\/\/\S+$/.test(u),
  'cover_url must be an /uploads/images/ path or an https URL',
)
const createSchema = z.object({
  category_id: z.string().regex(UUID_RE, 'category_id must be a uuid'),
  title_fa: z.string().trim().min(1).max(80),
  description_fa: z.string().trim().max(300).nullable().optional(),
  video_url: videoUrl,
  cover_url: coverUrl.nullable().optional(),
  duration_sec: z.number().positive().max(99999).nullable().optional(),
  file_bytes: z.number().int().positive().nullable().optional(),
  order_index: z.number().int().min(0).max(100000).optional(),
})
const patchSchema = createSchema.partial().extend({ is_published: z.boolean().optional() })

adminVideosRouter.post('/videos', requireAdmin, requirePermission('content.edit'),
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'invalid video' }); return }
    const d = parsed.data
    const cat = await queryOne('select 1 from video_categories where id = $1', [d.category_id])
    if (!cat) { res.status(400).json({ data: null, error: 'دسته پیدا نشد' }); return }
    // New videos go to the end of their category unless an order is given.
    const order = d.order_index ?? Number((await queryOne<{ n: number }>(
      'select coalesce(max(order_index), 0) + 1 as n from videos where category_id = $1', [d.category_id]))?.n ?? 1)
    const row = await queryOne<Video>(
      `insert into videos (category_id, title_fa, description_fa, video_url, cover_url, duration_sec, file_bytes, order_index, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning ${VIDEO_COLS}`,
      [d.category_id, d.title_fa, d.description_fa || null, d.video_url, d.cover_url || null,
        d.duration_sec ?? null, d.file_bytes ?? null, order, res.locals.adminEmail ?? null],
    )
    await logAudit(res.locals.adminEmail, 'video.create', 'video', row!.id, { title: d.title_fa })
    res.status(201).json({ data: row, error: null })
  }))

adminVideosRouter.patch('/videos/:id', requireAdmin, requirePermission('content.edit'),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)
    if (!UUID_RE.test(id)) { res.status(400).json({ data: null, error: 'id must be a uuid' }); return }
    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'invalid video' }); return }
    const d = parsed.data
    if (d.category_id && !(await queryOne('select 1 from video_categories where id = $1', [d.category_id]))) {
      res.status(400).json({ data: null, error: 'دسته پیدا نشد' }); return
    }
    const sets: string[] = []
    const vals: unknown[] = [id]
    const put = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`) }
    if (d.category_id !== undefined) put('category_id', d.category_id)
    if (d.title_fa !== undefined) put('title_fa', d.title_fa)
    if (d.description_fa !== undefined) put('description_fa', d.description_fa || null)
    if (d.video_url !== undefined) put('video_url', d.video_url)
    if (d.cover_url !== undefined) put('cover_url', d.cover_url || null)
    if (d.duration_sec !== undefined) put('duration_sec', d.duration_sec)
    if (d.file_bytes !== undefined) put('file_bytes', d.file_bytes)
    if (d.order_index !== undefined) put('order_index', d.order_index)
    if (d.is_published !== undefined) {
      put('is_published', d.is_published)
      if (d.is_published) sets.push('published_at = coalesce(published_at, now())')
    }
    if (sets.length === 0) { res.status(400).json({ data: null, error: 'nothing to update' }); return }
    sets.push('updated_at = now()')
    const row = await queryOne<Video>(`update videos set ${sets.join(', ')} where id = $1 returning ${VIDEO_COLS}`, vals)
    if (!row) { res.status(404).json({ data: null, error: 'video not found' }); return }
    const action = d.is_published === true ? 'video.publish' : d.is_published === false ? 'video.unpublish' : 'video.update'
    await logAudit(res.locals.adminEmail, action, 'video', id, { fields: Object.keys(d) })
    res.json({ data: row, error: null })
  }))

adminVideosRouter.delete('/videos/:id', requireAdmin, requirePermission('content.edit'),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)
    if (!UUID_RE.test(id)) { res.status(400).json({ data: null, error: 'id must be a uuid' }); return }
    const row = await queryOne<{ id: string; title_fa: string }>(
      'delete from videos where id = $1 and not is_published returning id, title_fa', [id])
    if (!row) { res.status(409).json({ data: null, error: 'فقط ویدیوی منتشرنشده را می‌شود حذف کرد' }); return }
    await logAudit(res.locals.adminEmail, 'video.delete', 'video', id, { title: row.title_fa })
    res.json({ data: { id }, error: null })
  }))

// Categories
const catSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, 'شناسه فقط حروف انگلیسی کوچک، عدد و خط تیره (۲ تا ۴۰)'),
  title_fa: z.string().trim().min(1).max(60),
  emoji: z.string().trim().max(8).nullable().optional(),
  order_index: z.number().int().min(0).max(100000).optional(),
})

adminVideosRouter.post('/video-categories', requireAdmin, requirePermission('content.edit'),
  asyncHandler(async (req, res) => {
    const parsed = catSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'invalid category' }); return }
    const d = parsed.data
    if (await queryOne('select 1 from video_categories where slug = $1', [d.slug])) {
      res.status(409).json({ data: null, error: 'این شناسه قبلاً استفاده شده' }); return
    }
    const order = d.order_index ?? Number((await queryOne<{ n: number }>(
      'select coalesce(max(order_index), 0) + 1 as n from video_categories'))?.n ?? 1)
    const row = await queryOne<VideoCategory>(
      `insert into video_categories (slug, title_fa, emoji, order_index) values ($1, $2, $3, $4) returning ${CAT_COLS}`,
      [d.slug, d.title_fa, d.emoji || null, order])
    await logAudit(res.locals.adminEmail, 'video_category.create', 'video_category', row!.id, { slug: d.slug })
    res.status(201).json({ data: row, error: null })
  }))

adminVideosRouter.patch('/video-categories/:id', requireAdmin, requirePermission('content.edit'),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)
    if (!UUID_RE.test(id)) { res.status(400).json({ data: null, error: 'id must be a uuid' }); return }
    const parsed = catSchema.partial().safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'invalid category' }); return }
    const d = parsed.data
    if (d.slug && await queryOne('select 1 from video_categories where slug = $1 and id <> $2', [d.slug, id])) {
      res.status(409).json({ data: null, error: 'این شناسه قبلاً استفاده شده' }); return
    }
    const row = await queryOne<VideoCategory>(
      `update video_categories set
          slug = coalesce($2, slug), title_fa = coalesce($3, title_fa),
          emoji = case when $4::boolean then $5 else emoji end,
          order_index = coalesce($6, order_index)
        where id = $1 returning ${CAT_COLS}`,
      [id, d.slug ?? null, d.title_fa ?? null, d.emoji !== undefined, d.emoji || null, d.order_index ?? null])
    if (!row) { res.status(404).json({ data: null, error: 'category not found' }); return }
    await logAudit(res.locals.adminEmail, 'video_category.update', 'video_category', id, { fields: Object.keys(d) })
    res.json({ data: row, error: null })
  }))

adminVideosRouter.delete('/video-categories/:id', requireAdmin, requirePermission('content.edit'),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)
    if (!UUID_RE.test(id)) { res.status(400).json({ data: null, error: 'id must be a uuid' }); return }
    if (await queryOne('select 1 from videos where category_id = $1 limit 1', [id])) {
      res.status(409).json({ data: null, error: 'این دسته ویدیو دارد — اول ویدیوها را جابه‌جا یا حذف کنید' }); return
    }
    const row = await queryOne<{ slug: string }>('delete from video_categories where id = $1 returning slug', [id])
    if (!row) { res.status(404).json({ data: null, error: 'category not found' }); return }
    await logAudit(res.locals.adminEmail, 'video_category.delete', 'video_category', id, { slug: row.slug })
    res.json({ data: { id }, error: null })
  }))

export default publicRouter
