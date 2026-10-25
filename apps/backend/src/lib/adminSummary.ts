/**
 * The daily admin summary — one Telegram DM a day (default 21:00
 * Europe/Berlin) with the day's numbers, so routine activity doesn't need a
 * message per event. Sent through lib/adminNotify (same bot, same dry-run
 * behaviour without a token).
 *
 * Scheduling runs in-process, like the read-aloud sweep in index.ts: a timer
 * checks every few minutes whether the summary hour has passed in the
 * configured time zone, and claims that day's slot in admin_notify_log
 * (migration 067) before sending — so it goes out exactly once a day even if
 * the backend restarts at 21:05, and a backend that was down at 21:00 sends
 * it as soon as it is back the same evening.
 *
 *   ADMIN_SUMMARY_TZ    IANA zone, default Europe/Berlin
 *   ADMIN_SUMMARY_HOUR  0-23 local hour, default 21
 */

import { queryOne } from './db'
import { claimSlot, sendMessage, type NotifyResult } from './adminNotify'
import { formatSummary, localDateHour, type DailyNumbers } from './adminSummaryFormat'

export { formatSummary, localDateHour, type DailyNumbers }

const TZ = process.env.ADMIN_SUMMARY_TZ || 'Europe/Berlin'
const HOUR = (() => {
  const h = Number(process.env.ADMIN_SUMMARY_HOUR ?? 21)
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 21
})()
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@koodakbook.com'
// Staff accounts (the env owner and anyone holding an admin role) are not
// families — the same filter routes/adminAnalytics.ts uses.
const REAL_USER = `u.email <> $2 and not exists (select 1 from user_roles ur where ur.user_id = u.id)`

/** The day's numbers, "today" meaning since local midnight in `tz`. */
export async function collectDailyNumbers(tz = TZ): Promise<DailyNumbers> {
  const row = await queryOne<Record<keyof DailyNumbers, string>>(
    `with b as (select (date_trunc('day', now() at time zone $1) at time zone $1) as start)
     select
       (select count(*) from users u, b where u.created_at >= b.start and ${REAL_USER}) as signups,
       (select count(*) from users u where ${REAL_USER}) as total_families,
       (select count(*) from children c, b where c.created_at >= b.start) as new_children,
       (select count(distinct child_id) from child_sessions s, b where s.started_at >= b.start) as active_children,
       (select count(distinct child_id) from child_sessions s where s.started_at >= now() - interval '7 days') as active_children_7d,
       (select count(*) from child_sessions s, b where s.started_at >= b.start) as sessions,
       (select coalesce(round(sum(duration_sec) / 60.0), 0) from child_sessions s, b where s.started_at >= b.start) as minutes,
       (select count(*) from child_lesson_progress p, b where p.completed and p.completed_at >= b.start) as lessons_done,
       (select count(*) from child_story_progress p, b where p.completed and p.last_read_at >= b.start) as stories_done,
       (select count(*) from stories s, b where s.ai_generated and s.created_at >= b.start) as ai_stories,
       (select coalesce(sum(amount), 0) from ai_usage_events e, b where e.kind = 'translate_pages' and e.created_at >= b.start) as ai_translate_pages,
       (select coalesce(sum(amount), 0) from ai_usage_events e, b where e.kind = 'audio_regen' and e.created_at >= b.start) as ai_audio_pages,
       (select count(*) from temp_premium_grants g, b where g.granted_at >= b.start) as temp_grants,
       (select count(*) from users u where u.plan <> 'free' and (u.plan_expires_at is null or u.plan_expires_at > now()) and ${REAL_USER}) as premium_active,
       (select count(*) from users u where u.stripe_subscription_id is not null and u.plan <> 'free'
          and (u.plan_expires_at is null or u.plan_expires_at > now()) and ${REAL_USER}) as paying,
       (select count(*) from audit_log a, b where a.action = 'billing.subscription_started' and a.created_at >= b.start) as new_subscriptions,
       (select count(*) from leads l, b where l.created_at >= b.start) as leads_today,
       (select count(*) from leads where status = 'new') as leads_open,
       (select count(*) from feedback f, b where f.created_at >= b.start) as feedback_today,
       (select count(*) from feedback where status in ('new', 'in_progress')) as feedback_open,
       (select count(*) from post_drafts where status = 'pending') as drafts_pending,
       (select count(*) from words where animation_review = 'pending' and image_candidate_url is not null) as word_images_pending,
       (select count(*) from stories where cover_review = 'pending' and cover_candidate_url is not null) as covers_pending`,
    [tz, ADMIN_EMAIL],
  )
  const out = {} as DailyNumbers
  for (const [k, v] of Object.entries(row ?? {})) (out as unknown as Record<string, number>)[k] = Number(v ?? 0)
  return out
}

/** Send today's summary now if the hour has passed and it hasn't gone out yet. */
export async function maybeSendDailySummary(now = new Date()): Promise<NotifyResult | 'not-yet'> {
  const { date, hour } = localDateHour(now, TZ)
  if (hour < HOUR) return 'not-yet'
  // 36h window: the key is per local date, so this only ever matters for
  // the same date; it just has to outlast the day.
  const slot = await claimSlot(`summary:${date}`, 36 * 60)
  if (!slot.send) return 'throttled'
  const numbers = await collectDailyNumbers(TZ)
  return sendMessage(formatSummary(date, numbers))
}

/** Start the in-process scheduler. Checks every 5 minutes. */
export function startDailySummary(): void {
  const tick = () => maybeSendDailySummary()
    .then(r => { if (r === 'sent' || r === 'dry-run') console.log(`[admin-summary] daily summary ${r}`) })
    .catch(err => console.error('[admin-summary] failed:', err))
  tick()
  setInterval(tick, 5 * 60 * 1000).unref()
}

/** For the admin panel's "send test summary" button: today's numbers, now. */
export async function sendSummaryNow(): Promise<NotifyResult> {
  const { date } = localDateHour(new Date(), TZ)
  return sendMessage(formatSummary(date, await collectDailyNumbers(TZ)))
}
