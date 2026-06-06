import { Router } from 'express'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/:child_id', requireAuth, async (req, res) => {
  const { child_id } = req.params

  const [child, sessions, wordProgress, storyProgress, lessonProgress, badges] = await Promise.all([
    queryOne('select * from children where id = $1', [child_id]),
    query(
      'select started_at, duration_sec from child_sessions where child_id = $1 order by started_at desc limit 30',
      [child_id]
    ),
    query('select status from child_word_progress where child_id = $1', [child_id]),
    query('select completed from child_story_progress where child_id = $1', [child_id]),
    query('select completed from child_lesson_progress where child_id = $1', [child_id]),
    query(
      `select cb.*, row_to_json(b.*) as badge
       from child_badges cb join badges b on b.id = cb.badge_id
       where cb.child_id = $1 order by cb.earned_at desc limit 5`,
      [child_id]
    ),
  ])

  if (!child) { res.status(404).json({ data: null, error: 'Child not found' }); return }

  // streak: count consecutive days going back from today
  const sessionDays = [...new Set(
    (sessions as { started_at: string }[]).map(s => s.started_at.slice(0, 10))
  )].sort().reverse()

  let streak_days = 0
  const today = new Date().toISOString().slice(0, 10)
  let cursor = today
  for (const day of sessionDays) {
    if (day === cursor) {
      streak_days++
      const d = new Date(cursor)
      d.setDate(d.getDate() - 1)
      cursor = d.toISOString().slice(0, 10)
    } else break
  }

  const words_learned    = (wordProgress    as { status: string }[]).filter(w => w.status !== 'introduced').length
  const mastered_words   = (wordProgress    as { status: string }[]).filter(w => w.status === 'mastered').length
  const stories_completed = (storyProgress  as { completed: boolean }[]).filter(s => s.completed).length
  const lessons_completed = (lessonProgress as { completed: boolean }[]).filter(l => l.completed).length

  // XP is derived from progress so it's always consistent (no separate counter to drift)
  const xp =
    words_learned * 5 +
    mastered_words * 5 +
    lessons_completed * 20 +
    stories_completed * 15 +
    streak_days * 10

  res.json({
    data: {
      child,
      streak_days,
      words_learned,
      stories_completed,
      lessons_completed,
      xp,
      recent_sessions: sessions.slice(0, 5),
      recent_badges: badges,
    },
    error: null,
  })
})

export default router
