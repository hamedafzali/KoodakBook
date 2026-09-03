import { Router } from 'express'
import { z } from 'zod'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { query, queryOne } from '../lib/db'
import { asyncHandler } from '../lib/asyncHandler'
import { postToChannel } from '../lib/telegramChannel'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* Telegram post approval queue (migration 055) — same shape as the story
 * cover review queue (adminStoryCovers.ts / migration 053), applied to text
 * bound for the public @koodakbook_app channel instead of image candidates.
 *
 * Every producer (story publish, the AI-scheduled generator) only ever calls
 * createDraft() below — never lib/telegramChannel directly. Approve is the
 * ONLY path in the codebase that calls postToChannel(); nothing auto-posts.
 * See docs/telegram-approval-queue.md. */

const router = Router()

export interface PostDraft {
  id: string
  source: 'story_published' | 'ai_scheduled' | 'manual'
  source_ref: string | null
  text: string
  image_path: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_note: string | null
  posted_at: string | null
  post_result: string | null
}

/** Insert a new draft into the queue. The one entry point every content
 *  producer uses — nothing else writes to post_drafts, and nothing here
 *  posts to Telegram. Fire-and-forget on the caller's side is expected (a
 *  queueing hiccup must never fail the story save or the generator run).
 *  image_path (migration 057) is a local /uploads path, not an external URL —
 *  see lib/telegramChannel.ts for why. */
export async function createDraft(input: {
  source: PostDraft['source']
  source_ref?: string | null
  text: string
  image_path?: string | null
}): Promise<PostDraft> {
  const [row] = await query<PostDraft>(
    `insert into post_drafts (source, source_ref, text, image_path) values ($1, $2, $3, $4) returning *`,
    [input.source, input.source_ref ?? null, input.text, input.image_path ?? null],
  )
  const { notifyNewDraft } = await import('../lib/adminNotify')
  notifyNewDraft({ id: row.id, preview: row.text }).catch(err =>
    console.error('[admin-notify] notifyNewDraft failed:', err),
  )
  return row
}

/* The queue. Default view is everything awaiting a human decision; ?status=
 * lets the admin look back at what they approved, rejected, or need to retry. */
router.get('/post-drafts/queue', requireAdmin, requirePermission('content.read'), async (req, res) => {
  const status = String(req.query.status ?? 'pending')
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ data: null, error: 'status must be pending, approved or rejected' }); return
  }
  const limit = Math.min(Number(req.query.limit ?? 60) || 60, 200)

  const drafts = await query<PostDraft>(
    `select * from post_drafts where status = $1 order by created_at desc limit $2`,
    [status, limit],
  )
  const counts = await queryOne<{ pending: string; approved: string; rejected: string }>(
    `select
       count(*) filter (where status = 'pending')  as pending,
       count(*) filter (where status = 'approved') as approved,
       count(*) filter (where status = 'rejected') as rejected
     from post_drafts`,
  )
  res.json({ data: { drafts, counts }, error: null })
})

const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
})

/* The gate. Approving posts in the same action — there is no separate
 * "publish" step to forget. Re-posting to this endpoint on an already-
 * approved-but-unsent draft (post_result = 'error') retries the send. */
router.post(
  '/post-drafts/:id/review',
  requireAdmin,
  requirePermission('content.edit'),
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(String(req.params.id))) {
      res.status(400).json({ data: null, error: 'id must be a uuid' }); return
    }
    const parsed = decisionSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ data: null, error: 'decision must be approved or rejected' }); return }
    const { decision, note } = parsed.data

    if (decision === 'rejected' && !note) {
      res.status(400).json({ data: null, error: 'دلیل رد کردن لازم است' }); return
    }

    const draft = await queryOne<PostDraft>('select * from post_drafts where id = $1', [req.params.id])
    if (!draft) { res.status(404).json({ data: null, error: 'draft not found' }); return }

    if (decision === 'rejected') {
      const row = await queryOne<PostDraft>(
        `update post_drafts
            set status = 'rejected', review_note = $2, reviewed_at = now(), reviewed_by = $3
          where id = $1
          returning *`,
        [req.params.id, note, res.locals.adminEmail ?? null],
      )
      res.json({ data: row, error: null }); return
    }

    // Approved (first time or a retry): send now, record the outcome either way.
    const result = await postToChannel(draft.text, draft.image_path)
    const row = await queryOne<PostDraft>(
      `update post_drafts
          set status      = 'approved',
              review_note = coalesce($2, review_note),
              reviewed_at = now(),
              reviewed_by = $3,
              posted_at   = case when $4 in ('sent', 'dry-run') then now() else posted_at end,
              post_result = $4
        where id = $1
        returning *`,
      [req.params.id, note ?? null, res.locals.adminEmail ?? null, result],
    )
    res.json({ data: row, error: null })
  }),
)

export default router
