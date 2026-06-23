import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'
import { checkAndAwardBadges } from './badges'
import { promoteStrands } from '../lib/strands'

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

  // Leitner: a correct rep promotes the word one box (max 5) and schedules the
  // next review further out; a miss drops it back to box 1 and resurfaces it soon.
  // Box 5 == mastered. Day intervals per destination box: 1,2,4,7,16.
  const [row] = await query(
    `insert into child_word_progress
       (child_id, word_id, status, box, due_at, last_reviewed_at, replay_count, mastered_at)
     values ($1, $2, $3, 1, now() + interval '1 day', now(), 1,
             case when $3 = 'mastered' then now() else null end)
     on conflict (child_id, word_id) do update set
       replay_count     = child_word_progress.replay_count + 1,
       last_reviewed_at = now(),
       box = case when $4 then least(child_word_progress.box + 1, 5) else 1 end,
       due_at = now() + (case
         when not $4 then interval '1 day'
         when least(child_word_progress.box + 1, 5) <= 1 then interval '1 day'
         when least(child_word_progress.box + 1, 5) = 2 then interval '2 days'
         when least(child_word_progress.box + 1, 5) = 3 then interval '4 days'
         when least(child_word_progress.box + 1, 5) = 4 then interval '7 days'
         else interval '16 days' end),
       status = case
         when $4 and least(child_word_progress.box + 1, 5) >= 5 then 'mastered'
         when child_word_progress.status = 'mastered' then 'mastered'
         else 'practiced' end,
       mastered_at = case
         when $4 and least(child_word_progress.box + 1, 5) >= 5
              and child_word_progress.mastered_at is null then now()
         else child_word_progress.mastered_at end
     returning *`,
    [child_id, word_id, status, correct]
  )

  // ── Parallel SR-split maintenance (mig-016) ──────────────
  // Additive: legacy box/due_at/status above stay authoritative for current
  // readers. Here we keep the new receptive/productive tracks + mastery state
  // in sync so the cutover (project.md §11.1) has truthful data to read.
  if (track === 'productive') {
    // The child produced the word. Advance the productive Leitner box on its own
    // schedule (day intervals per destination box: 1,2,4,7,16). Mastery never
    // gates on this track — it only bumps practicing upward, never downgrades.
    await query(
      `update child_word_progress set
         box_productive = case when $3 then least(coalesce(box_productive, 0) + 1, 5) else 1 end,
         due_productive = now() + (case
           when not $3 then interval '1 day'
           when least(coalesce(box_productive, 0) + 1, 5) <= 1 then interval '1 day'
           when least(coalesce(box_productive, 0) + 1, 5) = 2 then interval '2 days'
           when least(coalesce(box_productive, 0) + 1, 5) = 3 then interval '4 days'
           when least(coalesce(box_productive, 0) + 1, 5) = 4 then interval '7 days'
           else interval '16 days' end),
         mastery = case when mastery in ('mastered', 'consolidated') then mastery else 'practicing' end
       where child_id = $1 and word_id = $2`,
      [child_id, word_id, correct]
    )
  } else {
    // Receptive track mirrors the legacy single track we just wrote. mastery is
    // derived from the (monotonic) legacy status, so it never downgrades.
    await query(
      `update child_word_progress set
         box_receptive = box,
         due_receptive = due_at,
         mastery = case status
           when 'mastered'  then 'mastered'
           when 'practiced' then 'practicing'
           else 'introduced' end
       where child_id = $1 and word_id = $2`,
      [child_id, word_id]
    )
  }

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
  const promotions = await promoteStrands(child_id)
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
  const promotions = completed ? await promoteStrands(child_id) : []
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
