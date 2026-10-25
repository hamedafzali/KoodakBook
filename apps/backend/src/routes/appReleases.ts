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
import { validDraftText } from '../lib/postGuard'
import { createDraft } from './adminPostDrafts'
import { notifyAppReleasePublished } from '../lib/adminNotify'
import { releasePostText } from '../lib/appReleaseText'

/* Android builds handed out directly from koodakbook.eu.cc/app, outside
 * Google Play (migration 067, app_releases).
 *
 *   GET  /api/app/latest                 public — newest PUBLISHED release
 *   GET  /api/admin/app-releases         list (admin.manage)
 *   POST /api/admin/app-releases/upload  store an .apk under /uploads/apps
 *   POST /api/admin/app-releases         create a draft release row
 *   POST /api/admin/app-releases/:id/publish    make it the public one, queue
 *        a Telegram channel post for approval, ping the admin
 *   POST /api/admin/app-releases/:id/unpublish
 *   DELETE /api/admin/app-releases/:id   only while unpublished
 *
 * Publishing never posts to the public channel by itself: it adds a pending
 * draft to the same approval queue every other channel post goes through
 * (routes/adminPostDrafts.ts). A human still approves it there. */

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'
const APPS_DIR = path.join(UPLOADS_DIR, 'apps')
const WEB_URL = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const LINK_HOST = (() => { try { return new URL(WEB_URL).host } catch { return undefined } })()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// An APK of this app is ~60-120 MB; leave headroom but refuse anything silly.
const MAX_APK_BYTES = 300 * 1024 * 1024

export interface AppRelease {
  id: string
  platform: 'android'
  version_name: string
  version_code: number
  download_url: string
  file_bytes: number | null
  sha256: string | null
  notes: string | null
  is_published: boolean
  published_at: string | null
  created_by: string | null
  created_at: string
}

// file_bytes is bigint, which node-postgres returns as a string; read it as
// a float so the API returns a number (an APK is far below 2^53 bytes).
const PUBLIC_COLS = 'version_name, version_code, download_url, file_bytes::float8 as file_bytes, sha256, notes, published_at'
const ALL_COLS = `id, platform, version_name, version_code, download_url, file_bytes::float8 as file_bytes, sha256,
  notes, is_published, published_at, created_by, created_at`

// ── Public ─────────────────────────────────────────────────

const publicRouter = Router()

publicRouter.get('/latest', asyncHandler(async (_req, res) => {
  const row = await queryOne(
    `select ${PUBLIC_COLS} from app_releases
      where platform = 'android' and is_published
      order by version_code desc limit 1`,
  )
  // Short cache: a new release should reach the download page within minutes.
  res.set('Cache-Control', 'public, max-age=120')
  res.json({ data: row ?? null, error: null })
}))

// ── Admin ──────────────────────────────────────────────────

export const adminAppReleasesRouter = Router()

adminAppReleasesRouter.get('/app-releases', requireAdmin, requirePermission('admin.manage'),
  asyncHandler(async (_req, res) => {
    const rows = await query<AppRelease>(`select ${ALL_COLS} from app_releases order by version_code desc`)
    res.json({ data: rows, error: null })
  }))

fs.mkdirSync(APPS_DIR, { recursive: true })
const apkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, APPS_DIR),
    // Unique per upload, like every other upload path here, so the public
    // /uploads cache headers (immutable, 30 days) stay correct.
    filename: (_req, _file, cb) => cb(null, `koodakbook-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.apk`),
  }),
  limits: { fileSize: MAX_APK_BYTES },
  fileFilter: (_req, file, cb) => cb(null, /\.apk$/i.test(file.originalname)),
})

adminAppReleasesRouter.post('/app-releases/upload', requireAdmin, requirePermission('admin.manage'),
  apkUpload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) { res.status(400).json({ data: null, error: 'یک فایل .apk بفرستید' }); return }
    const sha256 = await new Promise<string>((resolve, reject) => {
      const h = crypto.createHash('sha256')
      fs.createReadStream(req.file!.path).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject)
    })
    res.json({
      data: { url: `/uploads/apps/${req.file.filename}`, bytes: req.file.size, sha256 },
      error: null,
    })
  }))

/* Chunked upload — what the admin panel uses. The admin's Next.js rewrite
 * proxy caps a request body at 10 MB and gives up after 30 s, so a ~110 MB
 * APK can't go up in one request ("آپلود ناموفق (500)"). Instead:
 *
 *   POST /app-releases/upload/start              → { upload_id }
 *   PUT  /app-releases/upload/:id/chunk?offset=N  raw bytes, ≤ 8 MB each, in order
 *   POST /app-releases/upload/:id/finish          { size } → { url, bytes, sha256 }
 *
 * Parts go to the OS temp dir (never the public uploads folder) and are
 * copied into /uploads/apps only once complete. A chunk is accepted only at
 * the current end of the part, so a retried chunk can't duplicate bytes. */
const CHUNK_MAX = 8 * 1024 * 1024
const PARTIAL_DIR = path.join(os.tmpdir(), 'koodakbook-apk-uploads')
fs.mkdirSync(PARTIAL_DIR, { recursive: true })
// Leftovers from abandoned uploads (older than a day) are removed at startup.
for (const f of fs.readdirSync(PARTIAL_DIR)) {
  const p = path.join(PARTIAL_DIR, f)
  try { if (Date.now() - fs.statSync(p).mtimeMs > 86_400_000) fs.unlinkSync(p) } catch { /* ignore */ }
}
const UPLOAD_ID_RE = /^[0-9a-f]{32}$/
const partPath = (id: string) => path.join(PARTIAL_DIR, `${id}.part`)

adminAppReleasesRouter.post('/app-releases/upload/start', requireAdmin, requirePermission('admin.manage'),
  asyncHandler(async (_req, res) => {
    const id = crypto.randomBytes(16).toString('hex')
    fs.writeFileSync(partPath(id), Buffer.alloc(0))
    res.json({ data: { upload_id: id, chunk_size: CHUNK_MAX }, error: null })
  }))

adminAppReleasesRouter.put('/app-releases/upload/:id/chunk', requireAdmin, requirePermission('admin.manage'),
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
      // The client resumes from `size` — tells it where the part really ends.
      res.status(409).json({ data: { size }, error: `offset must be ${size}` }); return
    }
    if (size + body.length > MAX_APK_BYTES) { res.status(413).json({ data: null, error: 'فایل خیلی بزرگ است' }); return }
    fs.appendFileSync(partPath(id), body)
    res.json({ data: { size: size + body.length }, error: null })
  }))

adminAppReleasesRouter.post('/app-releases/upload/:id/finish', requireAdmin, requirePermission('admin.manage'),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)
    if (!UPLOAD_ID_RE.test(id) || !fs.existsSync(partPath(id))) {
      res.status(404).json({ data: null, error: 'upload not found' }); return
    }
    const size = fs.statSync(partPath(id)).size
    if (Number(req.body?.size) !== size || size === 0) {
      res.status(409).json({ data: { size }, error: `فایل کامل نرسید (${size} از ${req.body?.size} بایت)` }); return
    }
    // An APK is a zip: refuse anything that doesn't start like one.
    const head = Buffer.alloc(4)
    const fd = fs.openSync(partPath(id), 'r'); fs.readSync(fd, head, 0, 4, 0); fs.closeSync(fd)
    if (head.readUInt32LE(0) !== 0x04034b50) {
      fs.unlinkSync(partPath(id))
      res.status(400).json({ data: null, error: 'این فایل APK نیست' }); return
    }
    const filename = `koodakbook-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.apk`
    const finalPath = path.join(APPS_DIR, filename)
    // Copy (not rename: the temp dir and the uploads volume are different
    // filesystems in Docker) and hash in the same pass.
    const sha256 = await new Promise<string>((resolve, reject) => {
      const h = crypto.createHash('sha256')
      const src = fs.createReadStream(partPath(id))
      const dst = fs.createWriteStream(finalPath)
      src.on('data', d => h.update(d)).on('error', reject)
      dst.on('error', reject).on('finish', () => resolve(h.digest('hex')))
      src.pipe(dst)
    })
    fs.unlinkSync(partPath(id))
    res.json({ data: { url: `/uploads/apps/${filename}`, bytes: size, sha256 }, error: null })
  }))

const createSchema = z.object({
  version_name: z.string().trim().min(1).max(40),
  version_code: z.number().int().positive(),
  // A /uploads/apps/... path from the upload above, or an https URL.
  download_url: z.string().trim().refine(
    u => u.startsWith('/uploads/apps/') || /^https:\/\/\S+$/.test(u),
    'download_url must be an /uploads/apps/ path or an https URL',
  ),
  file_bytes: z.number().int().positive().nullable().optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

adminAppReleasesRouter.post('/app-releases', requireAdmin, requirePermission('admin.manage'),
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'invalid release' }); return
    }
    const d = parsed.data
    const dup = await queryOne(`select 1 from app_releases where platform = 'android' and version_code = $1`, [d.version_code])
    if (dup) { res.status(409).json({ data: null, error: 'این کد نسخه قبلاً ثبت شده — کد نسخه باید بزرگ‌تر باشد' }); return }
    const row = await queryOne<AppRelease>(
      `insert into app_releases (version_name, version_code, download_url, file_bytes, sha256, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning ${ALL_COLS}`,
      [d.version_name, d.version_code, d.download_url, d.file_bytes ?? null, d.sha256 ?? null, d.notes || null,
        res.locals.adminEmail ?? null],
    )
    await logAudit(res.locals.adminEmail, 'app.release_create', 'app_release', row!.id,
      { version_name: d.version_name, version_code: d.version_code })
    res.status(201).json({ data: row, error: null })
  }))

adminAppReleasesRouter.post('/app-releases/:id/publish', requireAdmin, requirePermission('admin.manage'),
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ data: null, error: 'id must be a uuid' }); return }
    const rel = await queryOne<AppRelease>('select * from app_releases where id = $1', [req.params.id])
    if (!rel) { res.status(404).json({ data: null, error: 'release not found' }); return }

    // Check the channel text BEFORE publishing, so a release whose notes
    // break the content rules doesn't go public without its announcement.
    const wantPost = req.body?.announce !== false
    const text = releasePostText(rel, WEB_URL)
    if (wantPost && !validDraftText(text, { allowedLinkHost: LINK_HOST })) {
      res.status(400).json({ data: null, error: 'متن معرفی قوانین محتوا را رعایت نمی‌کند (طول، لینک یا کلمات ممنوع) — یادداشت نسخه را کوتاه‌تر کنید' })
      return
    }

    const row = await queryOne<AppRelease>(
      `update app_releases set is_published = true, published_at = coalesce(published_at, now())
        where id = $1 returning ${ALL_COLS}`,
      [rel.id],
    )
    let draftId: string | null = null
    if (wantPost) {
      const draft = await createDraft({ source: 'manual', source_ref: `app_release:${rel.version_code}`, text })
      draftId = draft.id
    }
    await logAudit(res.locals.adminEmail, 'app.release_publish', 'app_release', rel.id,
      { version_name: rel.version_name, version_code: rel.version_code, draft_id: draftId })
    notifyAppReleasePublished({ versionName: rel.version_name, versionCode: rel.version_code, url: `${WEB_URL}/app` })
      .catch(() => {})
    res.json({ data: { release: row, draft_id: draftId }, error: null })
  }))

adminAppReleasesRouter.post('/app-releases/:id/unpublish', requireAdmin, requirePermission('admin.manage'),
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ data: null, error: 'id must be a uuid' }); return }
    const row = await queryOne<AppRelease>(
      `update app_releases set is_published = false where id = $1 returning ${ALL_COLS}`, [req.params.id])
    if (!row) { res.status(404).json({ data: null, error: 'release not found' }); return }
    await logAudit(res.locals.adminEmail, 'app.release_unpublish', 'app_release', row.id, { version_code: row.version_code })
    res.json({ data: row, error: null })
  }))

adminAppReleasesRouter.delete('/app-releases/:id', requireAdmin, requirePermission('admin.manage'),
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ data: null, error: 'id must be a uuid' }); return }
    const row = await queryOne<AppRelease>(
      'delete from app_releases where id = $1 and not is_published returning *', [req.params.id])
    if (!row) { res.status(409).json({ data: null, error: 'فقط نسخه‌ی منتشرنشده را می‌شود حذف کرد' }); return }
    await logAudit(res.locals.adminEmail, 'app.release_delete', 'app_release', row.id, { version_code: row.version_code })
    res.json({ data: { id: row.id }, error: null })
  }))

export default publicRouter
