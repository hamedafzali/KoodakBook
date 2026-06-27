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

// ── GET /api/admin/content-readiness ─────────────────────
// What's missing for production: images (everything renders via emoji until
// these land) and native audio (TTS bootstrap vs recorded). Attacks the
// content-production blocker directly.
router.get('/content-readiness', requireAdmin, requirePermission('content.read'), async (_req, res) => {
  const c = await queryOne<Record<string, string>>(`select
    (select count(*) from words) words_total,
    (select count(*) from words where image_url is not null and image_url <> '') words_image,
    (select count(*) from words where audio_url is not null and audio_url <> '') words_audio,
    (select count(distinct entity_id) from audio_assets where entity_type='word' and source='native' and is_primary) words_native,
    (select count(*) from stories where not ai_generated) stories_total,
    (select count(*) from stories where not ai_generated and cover_url is not null) stories_cover,
    (select count(*) from stories where not ai_generated and audio_url is not null) stories_audio,
    (select count(*) from story_pages) pages_total,
    (select count(*) from story_pages where image_url is not null) pages_image,
    (select count(*) from story_pages where audio_url is not null) pages_audio,
    (select count(*) from letters) letters_total,
    (select count(*) from letters where audio_url is not null) letters_audio`)
  const missingImages = await query<{ persian: string; english: string; category: string }>(
    `select persian, english, category from words where image_url is null or image_url = '' order by category, persian limit 60`)
  const n = (k: string) => parseInt(c?.[k] ?? '0')
  res.json({
    data: {
      metrics: [
        { key: 'word_images',  label: 'تصویر واژه‌ها',        have: n('words_image'),   total: n('words_total'),   critical: true },
        { key: 'word_native',  label: 'صدای ضبط‌شده‌ی واژه‌ها', have: n('words_native'),  total: n('words_total') },
        { key: 'word_audio',   label: 'صدای واژه‌ها (هر نوع)',  have: n('words_audio'),   total: n('words_total') },
        { key: 'story_covers', label: 'جلد داستان‌ها',         have: n('stories_cover'), total: n('stories_total'), critical: true },
        { key: 'story_audio',  label: 'صدای کامل داستان‌ها',    have: n('stories_audio'), total: n('stories_total') },
        { key: 'page_images',  label: 'تصویر صفحات داستان',     have: n('pages_image'),   total: n('pages_total'),   critical: true },
        { key: 'page_audio',   label: 'صدای صفحات داستان',      have: n('pages_audio'),   total: n('pages_total') },
        { key: 'letter_audio', label: 'صدای حروف',             have: n('letters_audio'), total: n('letters_total') },
      ],
      missing_images: missingImages,
    },
    error: null,
  })
})

export default router
