import { Router } from 'express'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'
import { computeStreak } from '../lib/streak'

const router = Router()

router.get('/:child_id', requireAuth, requireChildOwner, async (req, res) => {
  const { child_id } = req.params

  const [child, sessions, wordProgress, storyProgress, lessonProgress, badges] = await Promise.all([
    queryOne('select * from children where id = $1', [child_id]),
    query(
      'select started_at, duration_sec from child_sessions where child_id = $1 order by started_at desc limit 30',
      [child_id]
    ),
    query('select mastery from child_word_progress where child_id = $1', [child_id]),
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

  // streak: count consecutive days going back from today, with a one-day
  // grace (expert review, streak hazard): a single missed calendar day is
  // forgiven once per computation rather than resetting the whole streak to
  // 0 — a child shouldn't lose visible progress because a parent didn't hand
  // over the tablet one day. Stateless: recomputed fresh from child_sessions
  // on every request, so there is nothing to "use up" across days — a real
  // second gap on a later day gets its own fresh grace token next time this
  // runs. Note this also smooths the pre-existing "haven't opened the app
  // yet today" case (today isn't in sessionDays yet) into the same grace
  // step, which is a reasonable side effect: a streak that was intact through
  // yesterday shouldn't read as broken before today's session has happened.
  // node-postgres returns timestamps as JS Date objects, so normalize through
  // Date() before slicing the YYYY-MM-DD day key (a raw .slice() on a Date throws).
  const sessionDays = [...new Set(
    (sessions as { started_at: string | Date }[]).map(
      s => new Date(s.started_at).toISOString().slice(0, 10)
    )
  )].sort().reverse()

  const today = new Date().toISOString().slice(0, 10)
  const streak_days = computeStreak(sessionDays, today)

  // Bucket words by the mastery state machine (mig-016). 'mastered' counts both
  // mastered and consolidated; 'words_learned' is everything past 'introduced'.
  const mastery_breakdown = { introduced: 0, practicing: 0, mastered: 0, consolidated: 0 }
  for (const w of wordProgress as { mastery: keyof typeof mastery_breakdown }[]) {
    if (w.mastery in mastery_breakdown) mastery_breakdown[w.mastery]++
  }
  const words_learned     = mastery_breakdown.practicing + mastery_breakdown.mastered + mastery_breakdown.consolidated
  const mastered_words    = mastery_breakdown.mastered + mastery_breakdown.consolidated
  const stories_completed = (storyProgress  as { completed: boolean }[]).filter(s => s.completed).length
  const lessons_completed = (lessonProgress as { completed: boolean }[]).filter(l => l.completed).length

  // XP is derived from progress so it's always consistent (no separate counter to drift).
  // streak_days deliberately NOT included (expert review, streak hazard): a
  // missed day already can't break the streak display past one grace day
  // (above), but even with that, XP must never be able to go DOWN or stall
  // because of a calendar gap outside the child's control — XP only reflects
  // learning that actually happened (words, lessons, stories), which never
  // un-happens.
  const xp =
    words_learned * 5 +
    mastered_words * 5 +
    lessons_completed * 20 +
    stories_completed * 15

  res.json({
    data: {
      child,
      streak_days,
      words_learned,
      stories_completed,
      lessons_completed,
      xp,
      mastery_breakdown,
      recent_sessions: sessions.slice(0, 5),
      recent_badges: badges,
    },
    error: null,
  })
})

export default router
