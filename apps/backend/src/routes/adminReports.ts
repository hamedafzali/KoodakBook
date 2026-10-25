import { Router } from 'express'
import { query, queryOne } from '../lib/db'
import { asyncHandler } from '../lib/asyncHandler'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { sendMessage } from '../lib/adminNotify'
import { sendSummaryNow } from '../lib/adminSummary'
import { isBillingConfigured } from '../lib/billing'

/* Admin reports (apps/admin /dashboard/reports). Four read-only views over the
 * tables the app already writes — nothing here is tracked separately:
 *
 *   GET /api/admin/reports/growth    families, children, plans, billing, leads, funnel
 *   GET /api/admin/reports/learning  active children, sessions, completions, retention
 *   GET /api/admin/reports/content   coverage (images/audio), review queues, story/word stats
 *   GET /api/admin/reports/system    AI/TTS usage, errors, deploys, database, integrations
 *
 * ?days=7|30|90 (default 30). Daily series use local days in ADMIN_SUMMARY_TZ
 * (default Europe/Berlin), the same calendar the daily Telegram summary uses.
 * Staff accounts (the env owner, anyone with an admin role) are excluded from
 * family counts, same as routes/adminAnalytics.ts. */

const router = Router()
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@koodakbook.com'
const TZ = process.env.ADMIN_SUMMARY_TZ || 'Europe/Berlin'
const REAL = (alias: string, emailParam: string) =>
  `${alias}.email <> ${emailParam} and not exists (select 1 from user_roles ur where ur.user_id = ${alias}.id)`

const gate = [requireAdmin, requirePermission('analytics.view')]

function periodDays(raw: unknown): number {
  const n = Number(raw)
  return [7, 30, 90].includes(n) ? n : 30
}

const num = (v: unknown) => Number(v ?? 0)
function numbers<T extends Record<string, unknown>>(row: T | null | undefined): Record<keyof T, number> {
  const out = {} as Record<keyof T, number>
  for (const [k, v] of Object.entries(row ?? {})) out[k as keyof T] = num(v)
  return out
}

/** Local-day buckets for the last `days` days: [{ day, s, e }] where s/e are
 *  the bucket's UTC bounds. Used as a lateral source for daily series. */
const DAYS_CTE = `days as (
  select gs::date as day,
         (gs::date)::timestamp at time zone $1 as s,
         (gs::date + 1)::timestamp at time zone $1 as e
    from generate_series((now() at time zone $1)::date - ($2::int - 1), (now() at time zone $1)::date, interval '1 day') gs
)`

// ── Growth & business ──────────────────────────────────────
router.get('/reports/growth', ...gate, asyncHandler(async (req, res) => {
  const days = periodDays(req.query.days)
  const P = [TZ, days, ADMIN_EMAIL]
  const [kpis, series, plans, billing, leads, funnel] = await Promise.all([
    queryOne(
      `select
         (select count(*) from users u where ${REAL('u', '$2')}) as families,
         (select count(*) from users u where u.created_at >= now() - make_interval(days => $1::int) and ${REAL('u', '$2')}) as new_families,
         (select count(*) from users u where u.created_at >= now() - make_interval(days => $1::int * 2)
            and u.created_at < now() - make_interval(days => $1::int) and ${REAL('u', '$2')}) as prev_new_families,
         (select count(*) from children) as children,
         (select count(*) from children where created_at >= now() - make_interval(days => $1::int)) as new_children,
         (select count(*) from users u where u.plan <> 'free' and (u.plan_expires_at is null or u.plan_expires_at > now()) and ${REAL('u', '$2')}) as premium_active,
         (select count(*) from users u where u.stripe_subscription_id is not null and u.plan <> 'free'
            and (u.plan_expires_at is null or u.plan_expires_at > now()) and ${REAL('u', '$2')}) as paying,
         (select count(*) from temp_premium_grants where granted_at >= now() - make_interval(days => $1::int)) as temp_grants,
         (select count(*) from leads where created_at >= now() - make_interval(days => $1::int)) as new_leads,
         (select count(*) from leads where status = 'new') as open_leads,
         (select count(*) from users u where u.status <> 'active' and ${REAL('u', '$2')}) as suspended`,
      [days, ADMIN_EMAIL],
    ),
    query<{ day: string; signups: string; children: string }>(
      `with ${DAYS_CTE}
       select to_char(d.day, 'YYYY-MM-DD') as day,
              (select count(*) from users u where u.created_at >= d.s and u.created_at < d.e and ${REAL('u', '$3')}) as signups,
              (select count(*) from children c where c.created_at >= d.s and c.created_at < d.e) as children
         from days d order by d.day`,
      P,
    ),
    query<{ plan: string; n: string }>(
      `select case when u.plan <> 'free' and u.plan_expires_at is not null and u.plan_expires_at <= now() then 'free (expired)' else u.plan end as plan,
              count(*) as n
         from users u where ${REAL('u', '$1')} group by 1 order by 2 desc`,
      [ADMIN_EMAIL],
    ),
    query<{ action: string; n: string }>(
      `select action, count(*) as n from audit_log
        where action like 'billing.%' and created_at >= now() - make_interval(days => $1::int)
        group by action`,
      [days],
    ),
    query<{ type: string; status: string; n: string }>(
      `select type, status, count(*) as n from leads
        where created_at >= now() - make_interval(days => $1::int) group by type, status`,
      [days],
    ),
    // Activation funnel for families who signed up in the period.
    queryOne(
      `with cohort as (select u.id from users u
                        where u.created_at >= now() - make_interval(days => $1::int) and ${REAL('u', '$2')})
       select
         (select count(*) from cohort) as signed_up,
         (select count(distinct c.parent_id) from children c join cohort on cohort.id = c.parent_id) as added_child,
         (select count(distinct c.parent_id) from children c join cohort on cohort.id = c.parent_id where c.placement_done) as placed,
         (select count(distinct c.parent_id) from children c join cohort on cohort.id = c.parent_id
            join child_lesson_progress p on p.child_id = c.id and p.completed) as first_lesson,
         (select count(distinct c.parent_id) from children c join cohort on cohort.id = c.parent_id
            join child_story_progress p on p.child_id = c.id and p.completed) as first_story,
         (select count(distinct c.parent_id) from children c join cohort on cohort.id = c.parent_id
            join child_sessions s on s.child_id = c.id and s.started_at >= c.created_at + interval '7 days') as came_back_week2`,
      [days, ADMIN_EMAIL],
    ),
  ])
  const billingCounts = Object.fromEntries(billing.map(b => [b.action.replace('billing.', ''), num(b.n)]))
  res.json({
    data: {
      days,
      kpis: numbers(kpis as Record<string, unknown>),
      series: series.map(r => ({ day: r.day, signups: num(r.signups), children: num(r.children) })),
      plans: plans.map(p => ({ plan: p.plan, count: num(p.n) })),
      billing: {
        configured: isBillingConfigured(),
        started: billingCounts.subscription_started ?? 0,
        cancel_scheduled: billingCounts.cancel_scheduled ?? 0,
        ended: billingCounts.subscription_ended ?? 0,
        payment_failed: billingCounts.payment_failed ?? 0,
      },
      leads: leads.map(l => ({ type: l.type, status: l.status, count: num(l.n) })),
      funnel: numbers(funnel as Record<string, unknown>),
    },
    error: null,
  })
}))

// ── Learning & engagement ──────────────────────────────────
router.get('/reports/learning', ...gate, asyncHandler(async (req, res) => {
  const days = periodDays(req.query.days)
  const [kpis, series, cohorts, levels, ages, lessons, mastery] = await Promise.all([
    queryOne(
      `select
         (select count(distinct child_id) from child_sessions where started_at >= now() - interval '1 day') as dau,
         (select count(distinct child_id) from child_sessions where started_at >= now() - interval '7 days') as wau,
         (select count(distinct child_id) from child_sessions where started_at >= now() - interval '30 days') as mau,
         (select count(distinct child_id) from child_sessions where started_at >= now() - make_interval(days => $1::int)) as active,
         (select count(*) from child_sessions where started_at >= now() - make_interval(days => $1::int)) as sessions,
         (select coalesce(round(sum(duration_sec) / 60.0), 0) from child_sessions where started_at >= now() - make_interval(days => $1::int)) as minutes,
         (select coalesce(round(avg(duration_sec) / 60.0, 1), 0) from child_sessions
            where started_at >= now() - make_interval(days => $1::int) and duration_sec > 0) as avg_session_min,
         (select count(*) from child_lesson_progress where completed and completed_at >= now() - make_interval(days => $1::int)) as lessons_done,
         (select count(*) from child_story_progress where completed and last_read_at >= now() - make_interval(days => $1::int)) as stories_done,
         (select count(*) from child_word_progress where mastered_at >= now() - make_interval(days => $1::int)) as words_mastered,
         (select count(*) from stories where ai_generated and created_at >= now() - make_interval(days => $1::int)) as ai_stories`,
      [days],
    ),
    query<{ day: string; active: string; sessions: string; minutes: string; lessons: string }>(
      `with ${DAYS_CTE}
       select to_char(d.day, 'YYYY-MM-DD') as day,
              (select count(distinct child_id) from child_sessions s where s.started_at >= d.s and s.started_at < d.e) as active,
              (select count(*) from child_sessions s where s.started_at >= d.s and s.started_at < d.e) as sessions,
              (select coalesce(round(sum(duration_sec) / 60.0), 0) from child_sessions s where s.started_at >= d.s and s.started_at < d.e) as minutes,
              (select count(*) from child_lesson_progress p where p.completed and p.completed_at >= d.s and p.completed_at < d.e) as lessons
         from days d order by d.day`,
      [TZ, days],
    ),
    // Weekly cohorts by the child's first week; retention = share of the
    // cohort with any session in week N after that.
    query<{ week: string; size: string; w: number; active: string }>(
      `with c as (
         select id, date_trunc('week', created_at) as wk from children
          where created_at >= date_trunc('week', now()) - interval '7 weeks'
       ), act as (
         select c.wk, c.id, floor(extract(epoch from (date_trunc('week', s.started_at) - c.wk)) / 604800)::int as w
           from c join child_sessions s on s.child_id = c.id
       )
       select to_char(c.wk, 'YYYY-MM-DD') as week,
              (select count(*) from c c2 where c2.wk = c.wk) as size,
              a.w, count(distinct a.id) as active
         from (select distinct wk from c) c
         left join act a on a.wk = c.wk and a.w between 0 and 6
        group by c.wk, a.w order by c.wk, a.w`,
    ),
    query<{ level: number; n: string }>(`select level, count(*) as n from children group by level order by level`),
    query<{ age: number | null; n: string }>(
      `select case when birth_year is null then null else extract(year from now())::int - birth_year end as age,
              count(*) as n from children group by 1 order by 1 nulls last`,
    ),
    query<{ title: string; completed: string; started: string }>(
      `select l.title, count(*) filter (where p.completed) as completed, count(p.child_id) as started
         from lessons l left join child_lesson_progress p on p.lesson_id = l.id
        group by l.id, l.title, l.order_index order by l.order_index`,
    ),
    query<{ mastery: string; n: string }>(`select mastery, count(*) as n from child_word_progress group by mastery`),
  ])

  // Fold the cohort rows into a matrix.
  const byWeek = new Map<string, { week: string; size: number; retention: (number | null)[] }>()
  const thisWeek = Date.now()
  for (const r of cohorts) {
    const entry = byWeek.get(r.week) ?? { week: r.week, size: num(r.size), retention: Array(7).fill(null) }
    const weeksOld = Math.floor((thisWeek - new Date(r.week).getTime()) / 604800000)
    for (let w = 0; w <= Math.min(6, weeksOld); w++) if (entry.retention[w] === null) entry.retention[w] = 0
    if (r.w !== null && r.w !== undefined && entry.size > 0) entry.retention[r.w] = num(r.active) / entry.size
    byWeek.set(r.week, entry)
  }

  res.json({
    data: {
      days,
      kpis: numbers(kpis as Record<string, unknown>),
      series: series.map(r => ({ day: r.day, active: num(r.active), sessions: num(r.sessions), minutes: num(r.minutes), lessons: num(r.lessons) })),
      cohorts: [...byWeek.values()],
      levels: levels.map(l => ({ level: l.level, count: num(l.n) })),
      ages: ages.map(a => ({ age: a.age, count: num(a.n) })),
      lessons: lessons.map(l => ({ title: l.title, completed: num(l.completed), started: num(l.started) })),
      mastery: Object.fromEntries(mastery.map(m => [m.mastery, num(m.n)])),
    },
    error: null,
  })
}))

// ── Content & quality ──────────────────────────────────────
router.get('/reports/content', ...gate, asyncHandler(async (req, res) => {
  const days = periodDays(req.query.days)
  const [coverage, queues, hardest, stories, categories] = await Promise.all([
    queryOne(
      `select
         (select count(*) from words) as words,
         (select count(*) from words where image_url is not null) as words_with_image,
         (select count(*) from words where audio_url is not null) as words_with_audio,
         (select count(*) from letters) as letters,
         (select count(*) from letters where audio_url is not null) as letters_with_audio,
         (select count(*) from stories where not ai_generated) as stories,
         (select count(*) from stories where not ai_generated and cover_url is not null) as stories_with_cover,
         (select count(*) from story_pages p join stories s on s.id = p.story_id where not s.ai_generated) as story_pages,
         (select count(*) from story_pages p join stories s on s.id = p.story_id where not s.ai_generated and p.audio_url is not null) as story_pages_with_audio,
         (select count(*) from lessons) as lessons,
         (select count(*) from stories where ai_generated) as ai_stories_total`,
    ),
    queryOne(
      `select
         (select count(*) from words where animation_review = 'pending' and image_candidate_url is not null) as word_images,
         (select count(*) from stories where cover_review = 'pending' and cover_candidate_url is not null) as covers,
         (select count(*) from post_drafts where status = 'pending') as drafts,
         (select count(*) from leads where status = 'new') as leads,
         (select count(*) from feedback where status in ('new', 'in_progress')) as feedback`,
    ),
    query<{ persian: string; english: string; avg_replay: string; learners: string }>(
      `select w.persian, w.english, round(avg(cwp.replay_count), 1) as avg_replay, count(*) as learners
         from child_word_progress cwp join words w on w.id = cwp.word_id
        group by w.id, w.persian, w.english having count(*) >= 2
        order by avg_replay desc nulls last limit 12`,
    ),
    query<{ title: string; started: string; completed: string; recent: string }>(
      `select s.title_persian as title, count(csp.story_id) as started,
              count(*) filter (where csp.completed) as completed,
              count(*) filter (where csp.last_read_at >= now() - make_interval(days => $1::int)) as recent
         from stories s left join child_story_progress csp on csp.story_id = s.id
        where not s.ai_generated group by s.id, s.title_persian order by started desc limit 20`,
      [days],
    ),
    query<{ category: string; total: string; with_image: string; with_audio: string }>(
      `select category, count(*) as total,
              count(*) filter (where image_url is not null) as with_image,
              count(*) filter (where audio_url is not null) as with_audio
         from words group by category order by category`,
    ),
  ])
  res.json({
    data: {
      days,
      coverage: numbers(coverage as Record<string, unknown>),
      queues: numbers(queues as Record<string, unknown>),
      hardest_words: hardest.map(h => ({ persian: h.persian, english: h.english, avg_replay: num(h.avg_replay), learners: num(h.learners) })),
      stories: stories.map(s => ({ title: s.title, started: num(s.started), completed: num(s.completed), recent: num(s.recent) })),
      categories: categories.map(c => ({ category: c.category, total: num(c.total), with_image: num(c.with_image), with_audio: num(c.with_audio) })),
    },
    error: null,
  })
}))

// ── System & costs ─────────────────────────────────────────
router.get('/reports/system', ...gate, asyncHandler(async (req, res) => {
  const days = periodDays(req.query.days)
  const [ai, tts, errors, deploys, db, tables, recordings, ai_settings] = await Promise.all([
    query<{ day: string; stories: string; translate: string; audio: string }>(
      `with ${DAYS_CTE}
       select to_char(d.day, 'YYYY-MM-DD') as day,
              (select count(*) from stories s where s.ai_generated and s.created_at >= d.s and s.created_at < d.e) as stories,
              (select coalesce(sum(amount), 0) from ai_usage_events e where e.kind = 'translate_pages' and e.created_at >= d.s and e.created_at < d.e) as translate,
              (select coalesce(sum(amount), 0) from ai_usage_events e where e.kind = 'audio_regen' and e.created_at >= d.s and e.created_at < d.e) as audio
         from days d order by d.day`,
      [TZ, days],
    ),
    query<{ month: string; chars: string }>(`select month, chars from tts_usage_monthly order by month desc limit 6`),
    query<{ key: string; last_sent_at: string; suppressed: number }>(
      `select key, last_sent_at, suppressed from admin_notify_log
        where (key like 'error:%' or key like 'crash:%' or key like 'ai:%')
          and last_sent_at >= now() - make_interval(days => $1::int)
        order by last_sent_at desc limit 30`,
      [days],
    ),
    query<{ created_at: string; detail: Record<string, unknown> }>(
      `select created_at, detail from audit_log where action = 'system.startup'
        order by created_at desc limit 15`,
    ),
    queryOne<{ size: string }>(`select pg_database_size(current_database()) as size`),
    query<{ name: string; bytes: string; rows: string }>(
      `select c.relname as name, pg_total_relation_size(c.oid) as bytes, greatest(c.reltuples, 0)::bigint as rows
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc limit 10`,
    ),
    queryOne<{ n: string; bytes: string }>(`select count(*) as n, coalesce(sum(bytes), 0) as bytes from read_aloud_recordings`),
    queryOne<{ provider: string | null }>(`select provider || ' · ' || model as provider from ai_settings where id = 1`).catch(() => null),
  ])
  const env = (k: string) => !!process.env[k]
  res.json({
    data: {
      days,
      ai: ai.map(r => ({ day: r.day, stories: num(r.stories), translate: num(r.translate), audio: num(r.audio) })),
      tts: tts.map(t => ({ month: t.month, chars: num(t.chars) })).reverse(),
      errors: errors.map(e => {
        const [kind, ...rest] = e.key.split(':')
        return { kind, detail: rest.join(':'), last_at: e.last_sent_at, suppressed: e.suppressed }
      }),
      deploys: deploys.map(d => ({ at: d.created_at, version: String(d.detail?.version ?? ''), migrations: (d.detail?.migrations as string[] | undefined) ?? [] })),
      database: { bytes: num(db?.size), tables: tables.map(t => ({ name: t.name, bytes: num(t.bytes), rows: num(t.rows) })) },
      recordings: { count: num(recordings?.n), bytes: num(recordings?.bytes) },
      integrations: {
        admin_telegram: env('ADMIN_TELEGRAM_BOT_TOKEN') && env('ADMIN_TELEGRAM_CHAT_ID'),
        alert_telegram: env('ALERT_TELEGRAM_BOT_TOKEN') && env('ALERT_TELEGRAM_CHAT_ID'),
        healthchecks: env('HEALTHCHECKS_PING_KEY'),
        channel_telegram: env('TELEGRAM_BOT_TOKEN'),
        stripe: isBillingConfigured(),
        ai: env('AI_API_KEY'),
        ai_provider: ai_settings?.provider ?? null,
        tts: env('TTS_API_KEY') || env('TTS_ELEVENLABS_KEY') || env('TTS_AZURE_KEY') || env('TTS_OPENAI_KEY'),
        summary: { tz: TZ, hour: Number(process.env.ADMIN_SUMMARY_HOUR ?? 21) },
      },
    },
    error: null,
  })
}))

// ── Notification tools ─────────────────────────────────────
router.post('/notify/test', requireAdmin, requirePermission('admin.manage'), asyncHandler(async (_req, res) => {
  const result = await sendMessage(`✅ پیام آزمایشی از پنل مدیریت کودک‌بوک\n${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`)
  res.json({ data: { result }, error: null })
}))

router.post('/notify/summary', requireAdmin, requirePermission('admin.manage'), asyncHandler(async (_req, res) => {
  const result = await sendSummaryNow()
  res.json({ data: { result }, error: null })
}))

export default router
