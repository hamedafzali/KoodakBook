import { Router } from 'express'
import { query, queryOne } from '../lib/db'
import { requireAdmin, requirePermission } from '../middleware/admin'

const router = Router()
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@koodakbook.com'
const REAL_USER = `u.email <> $1 and not exists (select 1 from user_roles ur where ur.user_id = u.id)`
const DAY = 86_400_000, WEEK = 7 * DAY

// ── GET /api/admin/analytics/overview ────────────────────
router.get('/analytics/overview', requireAdmin, requirePermission('analytics.view'), async (_req, res) => {
  const [signups, active, funnel, plans, hardest, topWords, stories, kids, sessions] = await Promise.all([
    query<{ d: string; n: string }>(
      `select to_char(date(created_at),'YYYY-MM-DD') d, count(*) n from users u
       where created_at > now() - interval '30 days' and ${REAL_USER} group by 1`, [ADMIN_EMAIL]),
    query<{ d: string; n: string }>(
      `select to_char(date(started_at),'YYYY-MM-DD') d, count(distinct child_id) n
       from child_sessions where started_at > now() - interval '30 days' group by 1`),
    queryOne<Record<string, string>>(
      `select
        (select count(*) from children) children,
        (select count(*) from children where placement_done) placement,
        (select count(distinct child_id) from child_lesson_progress where completed) lesson,
        (select count(distinct child_id) from child_story_progress where completed) story,
        (select count(distinct csp.child_id) from child_story_progress csp
           join stories s on s.id = csp.story_id where csp.completed and s.stage >= 3) activated`),
    query<{ plan: string; n: string }>(
      `select plan, count(*) n from users u where ${REAL_USER} group by plan`, [ADMIN_EMAIL]),
    query<{ persian: string; english: string; avg_replay: string; learners: string }>(
      `select w.persian, w.english, round(avg(cwp.replay_count),1) avg_replay, count(*) learners
       from child_word_progress cwp join words w on w.id = cwp.word_id
       group by w.id, w.persian, w.english having count(*) >= 1
       order by avg_replay desc nulls last limit 8`),
    query<{ persian: string; english: string; learners: string }>(
      `select w.persian, w.english, count(*) learners
       from child_word_progress cwp join words w on w.id = cwp.word_id
       group by w.id, w.persian, w.english order by learners desc limit 8`),
    query<{ title: string; started: string; completed: string }>(
      `select s.title_persian title, count(csp.story_id) started,
         count(*) filter (where csp.completed) completed
       from stories s left join child_story_progress csp on csp.story_id = s.id
       where not s.ai_generated group by s.id, s.title_persian order by started desc limit 10`),
    query<{ id: string; created_at: string }>(`select id, created_at from children`),
    query<{ child_id: string; started_at: string }>(`select child_id, started_at from child_sessions`),
  ])

  // 30-day growth series (fill gaps with 0)
  const sMap = new Map(signups.map(r => [r.d, +r.n]))
  const aMap = new Map(active.map(r => [r.d, +r.n]))
  const growth: { date: string; signups: number; active: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10)
    growth.push({ date: d, signups: sMap.get(d) ?? 0, active: aMap.get(d) ?? 0 })
  }

  // Weekly retention cohorts (last 6 weeks)
  const weekStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() - d.getDay() * DAY }
  const sessByChild = new Map<string, number[]>()
  for (const s of sessions) {
    const a = sessByChild.get(s.child_id) ?? []; a.push(new Date(s.started_at).getTime()); sessByChild.set(s.child_id, a)
  }
  const cohortMap = new Map<number, string[]>()
  for (const k of kids) {
    const w = weekStart(new Date(k.created_at).getTime())
    const a = cohortMap.get(w) ?? []; a.push(k.id); cohortMap.set(w, a)
  }
  const now = Date.now()
  const cohortWeeks = [...cohortMap.keys()].sort().slice(-6)
  const cohorts = cohortWeeks.map(w => {
    const ids = cohortMap.get(w)!
    const maxOffset = Math.min(5, Math.floor((now - w) / WEEK))
    const retention: (number | null)[] = []
    for (let k = 0; k <= 5; k++) {
      if (k > maxOffset) { retention.push(null); continue }
      const lo = w + k * WEEK, hi = lo + WEEK
      const ret = ids.filter(id => (sessByChild.get(id) ?? []).some(t => t >= lo && t < hi)).length
      retention.push(ids.length ? +(ret / ids.length).toFixed(2) : 0)
    }
    return { week: new Date(w).toISOString().slice(0, 10), size: ids.length, retention }
  })

  const num = (v: string | undefined) => parseInt(v ?? '0')
  res.json({
    data: {
      growth,
      funnel: {
        children: num(funnel?.children), placement: num(funnel?.placement),
        lesson: num(funnel?.lesson), story: num(funnel?.story), activated: num(funnel?.activated),
      },
      cohorts,
      plans: plans.map(p => ({ plan: p.plan, count: +p.n })),
      content: {
        hardest_words: hardest.map(w => ({ persian: w.persian, english: w.english, avg_replay: +w.avg_replay, learners: +w.learners })),
        top_words: topWords.map(w => ({ persian: w.persian, english: w.english, learners: +w.learners })),
        stories: stories.map(s => ({ title: s.title, started: +s.started, completed: +s.completed })),
      },
    },
    error: null,
  })
})

export default router
