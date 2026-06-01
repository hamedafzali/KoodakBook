import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { checkAndAwardBadges } from './badges'

const router = Router()

// ── Sessions ──────────────────────────────────────────────

router.post('/sessions/start', requireAuth, async (req, res) => {
  const { child_id } = req.body
  if (!child_id) { res.status(400).json({ data: null, error: 'child_id required' }); return }

  const [session] = await query(
    'insert into child_sessions (child_id) values ($1) returning *',
    [child_id]
  )
  res.status(201).json({ data: session, error: null })
})

// no requireAuth — session ID is a UUID secret; sendBeacon can't send headers
router.post('/sessions/:id/end', async (req, res) => {
  const session = await queryOne<{ started_at: string }>(
    'select started_at from child_sessions where id = $1',
    [req.params.id]
  )
  if (!session) { res.status(404).json({ data: null, error: 'Session not found' }); return }

  const duration_sec = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)
  const [updated] = await query(
    'update child_sessions set ended_at = now(), duration_sec = $1 where id = $2 returning *',
    [duration_sec, req.params.id]
  )
  res.json({ data: updated, error: null })
})

// ── Word progress ─────────────────────────────────────────

const wordProgressSchema = z.object({
  child_id: z.string().uuid(),
  word_id: z.string().uuid(),
  status: z.enum(['introduced', 'practiced', 'mastered']),
})

router.post('/word', requireAuth, async (req, res) => {
  const parsed = wordProgressSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }

  const { child_id, word_id, status } = parsed.data
  const mastered_at = status === 'mastered' ? 'now()' : null

  const [row] = await query(
    `insert into child_word_progress (child_id, word_id, status, mastered_at, replay_count)
     values ($1, $2, $3, ${mastered_at ? 'now()' : 'null'}, 1)
     on conflict (child_id, word_id) do update
       set status       = excluded.status,
           mastered_at  = case when excluded.status = 'mastered' then now() else child_word_progress.mastered_at end,
           replay_count = child_word_progress.replay_count + 1
     returning *`,
    [child_id, word_id, status]
  )

  const newBadges = await checkAndAwardBadges(child_id)
  res.json({ data: row, new_badges: newBadges, error: null })
})

// ── Lesson progress ───────────────────────────────────────

const lessonProgressSchema = z.object({
  child_id: z.string().uuid(),
  lesson_id: z.string().uuid(),
  score: z.number().int().min(0).max(100).optional(),
})

router.post('/lesson', requireAuth, async (req, res) => {
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
  res.json({ data: row, new_badges: newBadges, error: null })
})

// ── Story progress ────────────────────────────────────────

const storyProgressSchema = z.object({
  child_id: z.string().uuid(),
  story_id: z.string().uuid(),
  last_page: z.number().int().min(0),
  completed: z.boolean().optional(),
})

router.post('/story', requireAuth, async (req, res) => {
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
  res.json({ data: row, new_badges: newBadges, error: null })
})

// ── Full progress summary ─────────────────────────────────

router.get('/:child_id', requireAuth, async (req, res) => {
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
