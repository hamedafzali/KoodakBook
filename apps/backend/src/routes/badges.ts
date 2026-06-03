import { Router } from 'express'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/:child_id', requireAuth, async (req, res) => {
  const rows = await query(
    `select cb.*, row_to_json(b.*) as badge
     from child_badges cb
     join badges b on b.id = cb.badge_id
     where cb.child_id = $1
     order by cb.earned_at desc`,
    [req.params.child_id]
  )
  res.json({ data: rows, error: null })
})

export async function checkAndAwardBadges(child_id: string): Promise<{ key: string; title: string }[]> {
  const [wordCount, lessonCount, storyCount, alphabetCount, totalAlphabet, sessionRows, earnedKeys] =
    await Promise.all([
      queryOne<{ count: string }>(
        "select count(*) from child_word_progress where child_id = $1 and status = 'mastered'",
        [child_id]
      ),
      queryOne<{ count: string }>(
        'select count(*) from child_lesson_progress where child_id = $1 and completed = true',
        [child_id]
      ),
      queryOne<{ count: string }>(
        'select count(*) from child_story_progress where child_id = $1 and completed = true',
        [child_id]
      ),
      queryOne<{ count: string }>(
        `select count(*) from child_lesson_progress clp
         join lessons l on l.id = clp.lesson_id
         where clp.child_id = $1 and clp.completed = true and l.type = 'alphabet'`,
        [child_id]
      ),
      queryOne<{ count: string }>(
        "select count(*) from lessons where type = 'alphabet'",
        []
      ),
      query<{ started_at: string }>(
        'select started_at from child_sessions where child_id = $1 order by started_at desc limit 30',
        [child_id]
      ),
      query<{ key: string }>(
        'select b.key from child_badges cb join badges b on b.id = cb.badge_id where cb.child_id = $1',
        [child_id]
      ),
    ])

  // Distinct session days (most recent 30)
  const days = new Set(sessionRows.map(r => r.started_at.slice(0, 10)))
  const hasStreak7 = days.size >= 7
  const hasStreak3 = days.size >= 3
  const triedToday = days.has(new Date().toISOString().slice(0, 10))

  // A word reviewed more than once (effort, not just exposure)
  const repeated = await queryOne<{ count: string }>(
    'select count(*) from child_word_progress where child_id = $1 and replay_count >= 2',
    [child_id]
  )
  const hasRepeated = parseInt(repeated?.count ?? '0') >= 1

  const earned = new Set(earnedKeys.map(r => r.key))

  const words  = parseInt(wordCount?.count    ?? '0')
  const lessons = parseInt(lessonCount?.count ?? '0')
  const stories = parseInt(storyCount?.count  ?? '0')

  const eligible: string[] = []
  if (!earned.has('first_lesson')  && lessons >= 1)   eligible.push('first_lesson')
  if (!earned.has('first_story')   && stories >= 1)   eligible.push('first_story')
  if (!earned.has('words_10')      && words  >= 10)   eligible.push('words_10')
  if (!earned.has('words_25')      && words  >= 25)   eligible.push('words_25')
  if (!earned.has('stories_3')     && stories >= 3)   eligible.push('stories_3')
  if (!earned.has('lessons_5')     && lessons >= 5)   eligible.push('lessons_5')
  if (!earned.has('streak_7')      && hasStreak7)     eligible.push('streak_7')
  if (!earned.has('all_alphabet')  && parseInt(alphabetCount?.count ?? '0') >= parseInt(totalAlphabet?.count ?? '999')) eligible.push('all_alphabet')
  // Effort badges
  if (!earned.has('tried_today')     && triedToday)   eligible.push('tried_today')
  if (!earned.has('practiced_again') && hasRepeated)  eligible.push('practiced_again')
  if (!earned.has('streak_3')        && hasStreak3)   eligible.push('streak_3')

  if (eligible.length === 0) return []

  const badgeRows = await query<{ id: string; key: string; title: string }>(
    `select id, key, title from badges where key = any($1)`,
    [eligible]
  )

  if (badgeRows.length > 0) {
    await query(
      `insert into child_badges (child_id, badge_id)
       select $1, unnest($2::uuid[])
       on conflict do nothing`,
      [child_id, badgeRows.map(b => b.id)]
    )
  }

  return badgeRows.map(b => ({ key: b.key, title: b.title }))
}

export default router
