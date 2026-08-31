import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { z } from 'zod'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { query, queryOne } from '../lib/db'
import { asyncHandler } from '../lib/asyncHandler'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* Story cover review queue (migration 053) — same shape as the word-image
 * queue (adminWordImages.ts / migration 050), applied to stories.cover_url.
 *
 * The batch generator (tools/story-covers) produces candidate art offline via
 * the OpenAI Images API and pushes it here. Every candidate lands in
 * cover_candidate_url with cover_review='pending' and is invisible on the
 * story card. A human then approves (the ONLY path that writes cover_url) or
 * rejects with a reason. */

const router = Router()
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'
const MAX_BYTES = 10 * 1024 * 1024

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(UPLOADS_DIR, 'images')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png'
    cb(null, `storycover-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => cb(null, /\.(png|jpg|jpeg|webp)$/i.test(file.originalname)),
})

interface QueueRow {
  id: string
  title_persian: string
  title_english: string
  stage: number
  cover_url: string | null
  cover_candidate_url: string | null
  cover_review: string
  cover_review_note: string | null
}

/* The queue. Default view is everything awaiting a human click; ?status=
 * lets the admin look back at what they approved or rejected. */
router.get('/story-covers/queue', requireAdmin, requirePermission('content.read'), async (req, res) => {
  const status = String(req.query.status ?? 'pending')
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ data: null, error: 'status must be pending, approved or rejected' }); return
  }
  const limit = Math.min(Number(req.query.limit ?? 60) || 60, 200)

  const rows = await query<QueueRow>(
    `select id, title_persian, title_english, stage, cover_url, cover_candidate_url,
            cover_review, cover_review_note
       from stories
      where cover_review = $1
        and cover_candidate_url is not null
      order by title_english
      limit $2`,
    [status, limit],
  )

  const counts = await queryOne<{ pending: string; approved: string; rejected: string; no_cover: string }>(
    `select
       count(*) filter (where cover_review = 'pending'  and cover_candidate_url is not null) as pending,
       count(*) filter (where cover_review = 'approved' and cover_candidate_url is not null) as approved,
       count(*) filter (where cover_review = 'rejected' and cover_candidate_url is not null) as rejected,
       count(*) filter (where cover_url is null) as no_cover
     from stories`,
  )

  res.json({ data: { stories: rows, counts }, error: null })
})

/* Upload a generated candidate for one story. Sets the queue status back to
 * pending so a re-generated cover after a rejection returns to the queue
 * rather than inheriting the old verdict. */
router.post(
  '/story-covers/:storyId/candidate',
  requireAdmin,
  requirePermission('content.edit'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) { res.status(400).json({ data: null, error: 'file required' }); return }
    const storyId = String(req.params.storyId)
    if (!UUID_RE.test(storyId)) {
      fs.unlinkSync(path.join(path.resolve(UPLOADS_DIR, 'images'), req.file.filename))
      res.status(400).json({ data: null, error: 'storyId must be a uuid' }); return
    }
    const url = `/uploads/images/${req.file.filename}`

    const updated = await queryOne<{ id: string }>(
      `update stories
          set cover_candidate_url = $2,
              cover_review        = 'pending',
              cover_review_note   = null,
              cover_reviewed_at   = null
        where id = $1
        returning id`,
      [storyId, url],
    )
    if (!updated) {
      fs.unlinkSync(path.join(path.resolve(UPLOADS_DIR, 'images'), req.file.filename))
      res.status(404).json({ data: null, error: 'story not found' }); return
    }
    res.status(201).json({ data: { url }, error: null })
  }),
)

const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
})

/* The gate. Approve is the ONLY path in the codebase that writes cover_url
 * from a candidate; reject leaves cover_url untouched (so a previously
 * published cover survives a bad regeneration) and requires a reason. */
router.post(
  '/story-covers/:storyId/review',
  requireAdmin,
  requirePermission('content.edit'),
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(String(req.params.storyId))) {
      res.status(400).json({ data: null, error: 'storyId must be a uuid' }); return
    }
    const parsed = decisionSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ data: null, error: 'decision must be approved or rejected' }); return }
    const { decision, note } = parsed.data

    if (decision === 'rejected' && !note) {
      res.status(400).json({ data: null, error: 'دلیل رد کردن لازم است' }); return
    }

    const story = await queryOne<{ cover_candidate_url: string | null }>(
      'select cover_candidate_url from stories where id = $1', [req.params.storyId],
    )
    if (!story) { res.status(404).json({ data: null, error: 'story not found' }); return }
    if (!story.cover_candidate_url) {
      res.status(400).json({ data: null, error: 'این داستان تصویر جلد در انتظار بررسی ندارد' }); return
    }

    const row = decision === 'approved'
      ? await queryOne<QueueRow>(
          `update stories
              set cover_url         = cover_candidate_url,
                  cover_review      = 'approved',
                  cover_review_note = null,
                  cover_reviewed_at = now()
            where id = $1
            returning id, title_persian, title_english, stage, cover_url, cover_candidate_url,
                      cover_review, cover_review_note`,
          [req.params.storyId],
        )
      : await queryOne<QueueRow>(
          `update stories
              set cover_review      = 'rejected',
                  cover_review_note = $2,
                  cover_reviewed_at = now()
            where id = $1
            returning id, title_persian, title_english, stage, cover_url, cover_candidate_url,
                      cover_review, cover_review_note`,
          [req.params.storyId, note],
        )

    res.json({ data: row, error: null })
  }),
)

export default router
