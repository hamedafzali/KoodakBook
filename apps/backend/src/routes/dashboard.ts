import { Router } from 'express'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'
import { computeStreak } from '../lib/streak'
import { isRewardEligible, rewardExpiresAt, REWARD_PLAN_KEY, REWARD_DURATION_DAYS } from '../lib/engagementReward'

const router = Router()

router.get('/:child_id', requireAuth, requireChildOwner, async (req, res) => {
  const { child_id } = req.params

  const [child, sessions, wordProgress, storyProgress, lessonProgress, badges, practiceWords, account] = await Promise.all([
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
    // Parent-facing practice suggestions (path-and-plans review, "parent →
    // child learning loop"): words this child hasn't consolidated yet,
    // ordered by the Leitner engine's OWN due-date priority (mig-016) — the
    // same signal that already drives the review queue, just surfaced to the
    // parent instead of only the child. `spoken` (box_productive set and past
    // its first box) is the "recognises it but hasn't really said it yet"
    // flag ChatGPT's review specifically called out — a light truthy hint,
    // not a new metric invented for this.
    query(
      `select w.persian, w.english, w.image_url,
              (cwp.box_productive is not null and cwp.box_productive > 1) as spoken
         from child_word_progress cwp
         join words w on w.id = cwp.word_id
        where cwp.child_id = $1 and cwp.mastery in ('introduced', 'practicing')
        order by coalesce(cwp.due_receptive, cwp.due_productive, cwp.introduced_at) asc
        limit 5`,
      [child_id]
    ),
    // Own plan/last-grant lookup for the engagement-reward check below —
    // deliberately its own tiny query rather than joining onto one of the
    // child-scoped queries above, since this is account-level, not
    // child-level, data.
    queryOne<{ plan: string }>('select plan from users where id = $1', [res.locals.userId]),
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

  // Engagement reward (lib/engagementReward.ts): a free account with a real
  // streak on THIS child gets a short, occasional premium window — a carrot,
  // not a response to hitting a limit (that's the separate trial in
  // lib/tempPremiumTrial.ts / routes/ai.ts). Only checked for free accounts;
  // already-premium or already-in-a-temp-window accounts have plan !== 'free'
  // so this is a natural no-op for them without extra bookkeeping — the next
  // check after the reward plan lapses is what re-arms it, same pattern the
  // existing trial relies on for its own re-grants.
  let reward_unlocked_days: number | undefined
  if (account?.plan === 'free') {
    const nowIso = new Date().toISOString()
    const lastGrant = await queryOne<{ granted_at: string }>(
      `select granted_at::text as granted_at from temp_premium_grants
        where user_id = $1 order by granted_at desc limit 1`,
      [res.locals.userId],
    )
    if (isRewardEligible(streak_days, lastGrant?.granted_at ?? null, nowIso)) {
      const expiresAt = rewardExpiresAt(nowIso)
      await query('update users set plan = $2, plan_expires_at = $3 where id = $1',
        [res.locals.userId, REWARD_PLAN_KEY, expiresAt])
      await query(
        `insert into temp_premium_grants (user_id, plan_key, reason, expires_at)
         values ($1, $2, 'engagement_streak', $3)`,
        [res.locals.userId, REWARD_PLAN_KEY, expiresAt],
      )
      reward_unlocked_days = REWARD_DURATION_DAYS
    }
  }

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
      practice_words: practiceWords,
      // Present only on the request that just granted it, same one-shot
      // pattern routes/ai.ts uses for the frustration-trial unlock — lets
      // the client pop a "you unlocked N days of premium!" moment right
      // when it happens instead of the plan just quietly changing.
      reward_unlocked_days,
    },
    error: null,
  })
})

export default router
