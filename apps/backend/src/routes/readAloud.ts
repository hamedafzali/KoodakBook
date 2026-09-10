import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import fsp from 'fs/promises'
import crypto from 'crypto'
import { query, queryOne } from '../lib/db'
import { requireAuth, requireParent } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'
import { asyncHandler } from '../lib/asyncHandler'

/* ── Read-aloud recordings ───────────────────────────────────────────────────
 *
 * This route deliberately does NOT reuse /api/uploads, and that is the whole
 * point of it existing separately.
 *
 * /api/uploads writes into UPLOADS_DIR, which index.ts serves with
 * `express.static` — no auth, `immutable, max-age=30d`. That is correct for
 * story art and TTS clips, which are the same for every family. Putting a
 * child's voice there would publish it: a permanent unauthenticated URL, cached
 * for a month by anything in the path, readable by anyone who ever sees the
 * link. So the audio is written to READ_ALOUD_DIR, which nothing serves
 * statically, and comes back only through GET /:id/audio after an ownership
 * check, with `no-store`.
 *
 * Two more rules the rest of this codebase doesn't have and this table does:
 * a recording is refused unless the parent has given consent, and every
 * recording expires unless a parent explicitly keeps it. */

const READ_ALOUD_DIR = process.env.READ_ALOUD_DIR ?? './private/read-aloud'
fs.mkdirSync(READ_ALOUD_DIR, { recursive: true })

/** Default life of a recording the parent never acts on. */
const DEFAULT_TTL_DAYS = Number(process.env.READ_ALOUD_TTL_DAYS ?? 30)
/** ~3 minutes of Opus at a generous bitrate. A story read by a five-year-old
 *  is well under this; anything over is not a read-aloud. */
const MAX_BYTES = 8 * 1024 * 1024

/* MediaRecorder gives different containers per browser — webm/opus on Chrome
 * and Firefox, mp4/aac on Safari — so all three are accepted rather than
 * forcing a transcode the pilot doesn't need. Matched on the declared MIME
 * type, not the filename: the client builds the file from a Blob, so the
 * name is whatever we told it to send and proves nothing. */
const ALLOWED_MIME = new Set([
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac',
])
const EXT_FOR_MIME: Record<string, string> = {
  'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3', 'audio/aac': '.aac',
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME.has(file.mimetype.split(';')[0].trim()))
  },
})

const router = Router()

/** The one place that decides whether this account may store a child's voice. */
async function hasConsent(userId: string): Promise<boolean> {
  const row = await queryOne<{ read_aloud_consent_at: Date | null }>(
    'select read_aloud_consent_at from users where id = $1', [userId]
  )
  return !!row?.read_aloud_consent_at
}

// ── Consent ───────────────────────────────────────────────
// Parent scope only. A kid-login session shares the parent's account id, so
// without requireParent a child could consent on their parent's behalf.

router.get('/consent', requireAuth, asyncHandler(async (_req, res) => {
  const row = await queryOne<{ read_aloud_consent_at: Date | null }>(
    'select read_aloud_consent_at from users where id = $1', [res.locals.userId]
  )
  res.json({ data: { consented_at: row?.read_aloud_consent_at ?? null }, error: null })
}))

router.patch('/consent', requireAuth, requireParent, asyncHandler(async (req, res) => {
  const on = req.body?.consent === true
  const row = await queryOne<{ read_aloud_consent_at: Date | null }>(
    `update users set read_aloud_consent_at = $2 where id = $1
     returning read_aloud_consent_at`,
    [res.locals.userId, on ? new Date() : null]
  )
  res.json({ data: { consented_at: row?.read_aloud_consent_at ?? null }, error: null })
}))

// ── Record ────────────────────────────────────────────────

router.post('/', requireAuth, upload.single('audio'), requireChildOwner,
  asyncHandler(async (req, res) => {
    if (!req.file) { res.status(400).json({ data: null, error: 'No audio uploaded' }); return }

    // Checked after the ownership check so an unowned child_id can't be used to
    // probe whether some other account has consented.
    if (!await hasConsent(res.locals.userId)) {
      res.status(403).json({ data: null, error: 'ضبط صدا هنوز توسط والدین فعال نشده است' })
      return
    }

    const mime = req.file.mimetype.split(';')[0].trim()
    const ext = EXT_FOR_MIME[mime] ?? '.bin'
    // The filename is unguessable on its own, but that is defence in depth
    // rather than the control — nothing serves this directory.
    const key = `${res.locals.userId}/${crypto.randomUUID()}${ext}`
    const abs = path.join(READ_ALOUD_DIR, key)
    await fsp.mkdir(path.dirname(abs), { recursive: true })
    await fsp.writeFile(abs, req.file.buffer)

    const durationMs = Number(req.body?.duration_ms)
    const expires = new Date(Date.now() + DEFAULT_TTL_DAYS * 86400_000)

    try {
      const [row] = await query(
        `insert into read_aloud_recordings
           (child_id, story_id, storage_key, mime_type, bytes, duration_ms, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id, child_id, story_id, mime_type, bytes, duration_ms,
                   heard_at, kept, expires_at, created_at`,
        [req.body.child_id, req.body.story_id || null, key, mime, req.file.size,
         Number.isFinite(durationMs) ? Math.round(durationMs) : null, expires]
      )
      res.status(201).json({ data: row, error: null })
    } catch (err) {
      // Don't leave the file behind if the row never landed — an orphan on
      // disk is a child's voice with nothing tracking its expiry.
      await fsp.unlink(abs).catch(() => {})
      throw err
    }
  }))

// ── Read ──────────────────────────────────────────────────

router.get('/child/:child_id', requireAuth, requireChildOwner, asyncHandler(async (req, res) => {
  const rows = await query(
    `select r.id, r.child_id, r.story_id, s.title_persian as story_title, r.mime_type,
            r.bytes, r.duration_ms, r.heard_at, r.kept, r.expires_at, r.created_at
       from read_aloud_recordings r
       left join stories s on s.id = r.story_id
      where r.child_id = $1
      order by r.created_at desc
      limit 100`,
    [req.params.child_id]
  )
  res.json({ data: rows, error: null })
}))

/* Streams the audio. This is the only way the bytes leave the server, and it
 * is the reason the file is not under /uploads. `no-store` because a shared
 * cache holding a child's voice is exactly the failure this route avoids. */
router.get('/:id/audio', requireAuth, asyncHandler(async (req, res) => {
  const rec = await queryOne<{ storage_key: string; mime_type: string; child_id: string }>(
    `select r.storage_key, r.mime_type, r.child_id
       from read_aloud_recordings r
       join children c on c.id = r.child_id
      where r.id = $1 and c.parent_id = $2`,
    [req.params.id, res.locals.userId]
  )
  // A kid-login session is locked to its own child, same rule as childOwner.
  if (!rec || (res.locals.scope === 'child' && res.locals.childId !== rec.child_id)) {
    res.status(404).json({ data: null, error: 'Not found' })
    return
  }

  const abs = path.join(READ_ALOUD_DIR, rec.storage_key)
  // storage_key is written by this file and never by a client, but resolve and
  // re-check anyway: a path that escapes the directory must not be servable.
  if (!path.resolve(abs).startsWith(path.resolve(READ_ALOUD_DIR) + path.sep)) {
    res.status(404).json({ data: null, error: 'Not found' }); return
  }
  if (!fs.existsSync(abs)) { res.status(404).json({ data: null, error: 'Not found' }); return }

  res.setHeader('Content-Type', rec.mime_type)
  res.setHeader('Cache-Control', 'no-store, private')
  res.setHeader('Content-Disposition', 'inline')
  fs.createReadStream(abs).pipe(res)
}))

// ── Parent actions ────────────────────────────────────────

/** Marks a recording heard. Separate from the stream so a preload or a range
 *  request can't silently clear the "new" marker. */
router.post('/:id/heard', requireAuth, requireParent, asyncHandler(async (req, res) => {
  const row = await queryOne(
    `update read_aloud_recordings r set heard_at = coalesce(r.heard_at, now())
       from children c
      where r.id = $1 and c.id = r.child_id and c.parent_id = $2
      returning r.id, r.heard_at`,
    [req.params.id, res.locals.userId]
  )
  if (!row) { res.status(404).json({ data: null, error: 'Not found' }); return }
  res.json({ data: row, error: null })
}))

router.patch('/:id', requireAuth, requireParent, asyncHandler(async (req, res) => {
  if (typeof req.body?.kept !== 'boolean') {
    res.status(400).json({ data: null, error: 'kept (boolean) required' }); return
  }
  const row = await queryOne(
    `update read_aloud_recordings r set kept = $3
       from children c
      where r.id = $1 and c.id = r.child_id and c.parent_id = $2
      returning r.id, r.kept, r.expires_at`,
    [req.params.id, res.locals.userId, req.body.kept]
  )
  if (!row) { res.status(404).json({ data: null, error: 'Not found' }); return }
  res.json({ data: row, error: null })
}))

router.delete('/:id', requireAuth, requireParent, asyncHandler(async (req, res) => {
  const row = await queryOne<{ storage_key: string }>(
    `delete from read_aloud_recordings r
       using children c
      where r.id = $1 and c.id = r.child_id and c.parent_id = $2
      returning r.storage_key`,
    [req.params.id, res.locals.userId]
  )
  if (!row) { res.status(404).json({ data: null, error: 'Not found' }); return }
  await fsp.unlink(path.join(READ_ALOUD_DIR, row.storage_key)).catch(() => {})
  res.json({ data: { deleted: true }, error: null })
}))

/* Deletes expired recordings, row and file together. Called on an interval from
 * index.ts. The row is deleted first and the file second: a file left behind by
 * a crash between the two is findable and deletable, whereas a row pointing at
 * a file that's already gone would render as a recording that won't play. */
export async function sweepExpiredReadAloud(): Promise<number> {
  const rows = await query<{ storage_key: string }>(
    `delete from read_aloud_recordings
      where not kept and expires_at < now()
      returning storage_key`
  )
  for (const r of rows) {
    await fsp.unlink(path.join(READ_ALOUD_DIR, r.storage_key)).catch(() => {})
  }
  return rows.length
}

export default router
