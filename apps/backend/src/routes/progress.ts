import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne, withTransaction } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'
import { checkAndAwardBadges } from './badges'
import { promoteStrands } from '../lib/strands'
import { planWordProgress, type WordProgressPrev } from '../lib/wordProgress'

const router = Router()

// ── Sessions ──────────────────────────────────────────────

router.post('/sessions/start', requireAuth, requireChildOwner, async (req, res) => {
  const { child_id } = req.body
  if (!child_id) { res.status(400).json({ data: null, error: 'child_id required' }); return }

  const [session] = await query(
    'insert into child_sessions (child_id) values ($1) returning *',
    [child_id]
  )
  res.status(201).json({ data: session, error: null })
})

// no requireAuth — session ID is an unguessable UUID; sendBeacon can't send headers.
// Idempotent: only the first end call records duration, so repeated beacons
// (visibility + unmount + beforeunload all fire) cannot inflate session time.
router.post('/sessions/:id/end', async (req, res) => {
  const session = await queryOne<{ started_at: string; ended_at: string | null }>(
    'select started_at, ended_at from child_sessions where id = $1',
    [req.params.id]
  )
  if (!session) { res.status(404).json({ data: null, error: 'Session not found' }); return }
  if (session.ended_at) { res.json({ data: { ok: true, already_ended: true }, error: null }); return }

  // Cap absurd durations (e.g. tab left open overnight) at 1 hour
  const raw = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)
  const duration_sec = Math.min(Math.max(raw, 0), 3600)

  const [updated] = await query(
    'update child_sessions set ended_at = now(), duration_sec = $1 where id = $2 and ended_at is null returning *',
    [duration_sec, req.params.id]
  )
  res.json({ data: updated ?? { ok: true }, error: null })
})

// ── Word progress ─────────────────────────────────────────

const wordProgressSchema = z.object({
  child_id: z.string().uuid(),
  word_id: z.string().uuid(),
  status: z.enum(['introduced', 'practiced', 'mastered']),
  // Leitner outcome of this interaction. Omitted = treated as a correct rep
  // (so existing lesson/speak callers keep working unchanged).
  result: z.enum(['correct', 'incorrect']).optional(),
  // Which memory track this interaction exercises (mig-016). 'productive' =
  // the child SAID/RECALLED the word (speak page); 'receptive' (default) =
  // hear→recognise (lessons, review). Omitted = receptive, backward-compatible.
  track: z.enum(['receptive', 'productive']).optional(),
})

router.post('/word', requireAuth, requireChildOwner, async (req, res) => {
  const parsed = wordProgressSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }

  const { child_id, word_id, status, result, track } = parsed.data
  const correct = result !== 'incorrect'
  const trackVal = track ?? 'receptive'

  // Dual-track SR (mig-016). The routing — which track's box/due this interaction
  // moves — lives in planWordProgress (pure, unit-tested in wordProgress.test.ts).
  // BUG-A: a productive rep must NEVER touch the receptive schedule, and vice
  // versa; the planner guarantees exactly one of plan.receptive/plan.productive
  // is set. Read-then-write under a row lock keeps the two writes atomic.
  const row = await withTransaction(async (c) => {
    const prev =
      (await c.query<WordProgressPrev>(
        `select box, status, mastered_at, box_productive, mastery
           from child_word_progress
          where child_id = $1 and word_id = $2
          for update`,
        [child_id, word_id]
      )).rows[0] ?? null

    const plan = planWordProgress(prev, { track: trackVal, correct, status })

    if (!prev) {
      // Establish the row with column defaults (box 1, due_at null, status
      // 'introduced', box_productive null, mastery 'introduced'); the plan below
      // writes only the track this interaction actually exercised. A productive
      // first-ever rep therefore does NOT schedule a receptive review (BUG-A).
      await c.query(
        `insert into child_word_progress (child_id, word_id, replay_count)
           values ($1, $2, 0)
         on conflict (child_id, word_id) do nothing`,
        [child_id, word_id]
      )
    }

    if (plan.receptive) {
      const r = plan.receptive
      return (await c.query(
        `update child_word_progress set
           replay_count     = replay_count + 1,
           last_reviewed_at = now(),
           box           = $3,
           due_at        = now() + make_interval(days => $4),
           status        = $5,
           mastered_at   = case when $6 and mastered_at is null then now() else mastered_at end,
           box_receptive = $3,
           due_receptive = now() + make_interval(days => $4),
           mastery       = $7
         where child_id = $1 and word_id = $2
         returning *`,
        [child_id, word_id, r.box, r.intervalDays, r.status, r.stampMasteredAt, plan.mastery]
      )).rows[0]
    }

    // Productive: legacy box/due_at/status are deliberately left untouched.
    const p = plan.productive!
    return (await c.query(
      `update child_word_progress set
         replay_count     = replay_count + 1,
         last_reviewed_at = now(),
         box_productive = $3,
         due_productive = now() + make_interval(days => $4),
         mastery        = $5
       where child_id = $1 and word_id = $2
       returning *`,
      [child_id, word_id, p.box, p.intervalDays, plan.mastery]
    )).rows[0]
  })

  const newBadges = await checkAndAwardBadges(child_id)
  res.json({ data: row, new_badges: newBadges, error: null })
})

// ── Words due for spaced-repetition review ─────────────────
router.get('/:child_id/review', requireAuth, requireChildOwner, async (req, res) => {
  const rows = await query(
    // word.audio_url is resolved from the primary audio_asset (native > tts, mig-018).
    `select cwp.word_id, cwp.box, cwp.due_at,
       to_jsonb(w) || jsonb_build_object('audio_url', coalesce(primary_audio('word', w.id), w.audio_url)) as word
     from child_word_progress cwp
     join words w on w.id = cwp.word_id
     where cwp.child_id = $1
       and cwp.status <> 'introduced'
       and cwp.due_at is not null
       and cwp.due_at <= now()
     order by cwp.due_at asc
     limit 20`,
    [req.params.child_id]
  )
  res.json({ data: rows, error: null })
})

// ── Lesson progress ───────────────────────────────────────

const lessonProgressSchema = z.object({
  child_id: z.string().uuid(),
  lesson_id: z.string().uuid(),
  score: z.number().int().min(0).max(100).optional(),
})

router.post('/lesson', requireAuth, requireChildOwner, async (req, res) => {
  const parsed = lessonProgressSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }

  const { child_id, lesson_id, score } = parsed.data
  const [row] = await query(
    `insert into child_lesson_progress (child_id, lesson_id, completed, score, completed_at)
     values ($1, $2, true, $3, now())
     on conflict (child_id, lesson_id) do update
       set completed = true, score = excluded.score, completed_at = now()
     returning *`,
    [child_id, lesson_id, score ?? 100]
  )

  const newBadges = await checkAndAwardBadges(child_id)
  const promotions = await promoteStrands(child_id, 'lesson')
  res.json({ data: row, new_badges: newBadges, promotions, error: null })
})

// ── Story progress ────────────────────────────────────────

const storyProgressSchema = z.object({
  child_id: z.string().uuid(),
  story_id: z.string().uuid(),
  last_page: z.number().int().min(0),
  completed: z.boolean().optional(),
})

router.post('/story', requireAuth, requireChildOwner, async (req, res) => {
  const parsed = storyProgressSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }

  const { child_id, story_id, last_page, completed } = parsed.data
  const [row] = await query(
    `insert into child_story_progress (child_id, story_id, last_page, completed, last_read_at)
     values ($1, $2, $3, $4, now())
     on conflict (child_id, story_id) do update
       set last_page    = excluded.last_page,
           completed    = excluded.completed,
           replay_count = case when excluded.completed then child_story_progress.replay_count + 1 else child_story_progress.replay_count end,
           last_read_at = now()
     returning *`,
    [child_id, story_id, last_page, completed ?? false]
  )

  const newBadges = await checkAndAwardBadges(child_id)
  const promotions = completed ? await promoteStrands(child_id, 'story') : []
  res.json({ data: row, new_badges: newBadges, promotions, error: null })
})

// ── Full progress summary ─────────────────────────────────

router.get('/:child_id', requireAuth, requireChildOwner, async (req, res) => {
  const { child_id } = req.params
  const [words, lessons, stories, sessions] = await Promise.all([
    query('select * from child_word_progress where child_id = $1', [child_id]),
    query('select * from child_lesson_progress where child_id = $1', [child_id]),
    query('select * from child_story_progress where child_id = $1', [child_id]),
    query('select * from child_sessions where child_id = $1 order by started_at desc limit 10', [child_id]),
  ])
  res.json({ data: { words, lessons, stories, recent_sessions: sessions }, error: null })
})

export default router
