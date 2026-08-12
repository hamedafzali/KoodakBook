import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { z } from 'zod'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { query, queryOne } from '../lib/db'

/* Word-image review queue (migration 050).
 *
 * The batch generator in tools/word-images produces candidate art offline
 * (local ComfyUI/SDXL) and pushes it here. Every candidate lands in
 * image_candidate_url with animation_review='pending' and is invisible to
 * children. A human then approves (the ONLY path that writes image_url) or
 * rejects with a reason.
 *
 * Why the upload endpoint is admin-gated rather than a machine token: this is
 * an occasional batch job a human runs by hand, so it can carry the operator's
 * own admin credentials. There is no runtime dependency on the generator. */

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
    cb(null, `wordgen-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => cb(null, /\.(png|jpg|jpeg|webp)$/i.test(file.originalname)),
})

interface QueueRow {
  id: string
  persian: string
  english: string
  category: string
  image_url: string | null
  image_candidate_url: string | null
  image_brief: unknown
  animation_review: string
  image_review_note: string | null
}

/* The queue. Default view is everything awaiting a human click; ?status=
 * lets the admin look back at what they approved or rejected. */
router.get('/word-images/queue', requireAdmin, requirePermission('content.read'), async (req, res) => {
  const status = String(req.query.status ?? 'pending')
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ data: null, error: 'status must be pending, approved or rejected' }); return
  }
  const limit = Math.min(Number(req.query.limit ?? 60) || 60, 200)

  // 'pending' means "has a candidate a human has not ruled on yet" — a word
  // with no candidate is not in the queue, it just has no art.
  const rows = await query<QueueRow>(
    `select id, persian, english, category, image_url, image_candidate_url,
            image_brief, animation_review, image_review_note
       from words
      where animation_review = $1
        and image_candidate_url is not null
      order by category, english
      limit $2`,
    [status, limit],
  )

  const counts = await queryOne<{ pending: string; approved: string; rejected: string; no_image: string }>(
    `select
       count(*) filter (where animation_review = 'pending'  and image_candidate_url is not null) as pending,
       count(*) filter (where animation_review = 'approved' and image_candidate_url is not null) as approved,
       count(*) filter (where animation_review = 'rejected' and image_candidate_url is not null) as rejected,
       count(*) filter (where image_url is null) as no_image
     from words`,
  )

  res.json({ data: { words: rows, counts }, error: null })
})

/* Upload a generated candidate for one word. Sets the queue status back to
 * pending so a re-generated image after a rejection returns to the queue
 * rather than inheriting the old verdict. */
router.post(
  '/word-images/:wordId/candidate',
  requireAdmin,
  requirePermission('content.edit'),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) { res.status(400).json({ data: null, error: 'file required' }); return }
    const wordId = req.params.wordId
    const url = `/uploads/images/${req.file.filename}`

    const updated = await queryOne<{ id: string }>(
      `update words
          set image_candidate_url = $2,
              animation_review    = 'pending',
              image_review_note   = null,
              image_reviewed_at   = null
        where id = $1
        returning id`,
      [wordId, url],
    )
    if (!updated) {
      fs.unlinkSync(path.join(path.resolve(UPLOADS_DIR, 'images'), req.file.filename))
      res.status(404).json({ data: null, error: 'word not found' }); return
    }
    res.status(201).json({ data: { url }, error: null })
  },
)

const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
})

/* The gate. Approve is the ONLY path in the codebase that writes image_url
 * from a candidate; reject leaves image_url untouched (so a previously
 * published image survives a bad regeneration) and requires a reason. */
router.post(
  '/word-images/:wordId/review',
  requireAdmin,
  requirePermission('content.edit'),
  async (req, res) => {
    const parsed = decisionSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ data: null, error: 'decision must be approved or rejected' }); return }
    const { decision, note } = parsed.data

    if (decision === 'rejected' && !note) {
      res.status(400).json({ data: null, error: 'دلیل رد کردن لازم است' }); return
    }

    const word = await queryOne<{ image_candidate_url: string | null }>(
      'select image_candidate_url from words where id = $1', [req.params.wordId],
    )
    if (!word) { res.status(404).json({ data: null, error: 'word not found' }); return }
    if (!word.image_candidate_url) {
      res.status(400).json({ data: null, error: 'این کلمه تصویر در انتظار بررسی ندارد' }); return
    }

    const row = decision === 'approved'
      ? await queryOne<QueueRow>(
          `update words
              set image_url         = image_candidate_url,
                  animation_review  = 'approved',
                  image_review_note = null,
                  image_reviewed_at = now()
            where id = $1
            returning id, persian, english, category, image_url, image_candidate_url,
                      image_brief, animation_review, image_review_note`,
          [req.params.wordId],
        )
      : await queryOne<QueueRow>(
          `update words
              set animation_review  = 'rejected',
                  image_review_note = $2,
                  image_reviewed_at = now()
            where id = $1
            returning id, persian, english, category, image_url, image_candidate_url,
                      image_brief, animation_review, image_review_note`,
          [req.params.wordId, note],
        )

    res.json({ data: row, error: null })
  },
)

export default router
