import type { DashboardSummary, BadgeKey } from '@koodakbook/shared'

/* ── The parent dashboard's headline ────────────────────────────────────────
 *
 * The dashboard used to open with nine equal-weight cards and no answer. The
 * parent's actual question is not "how many minutes?" — it's "is this
 * working?", and that question is answered by a sentence, not a number.
 *
 * The hard constraint is that the sentence has to be TRUE. `DashboardSummary`
 * carries no week-over-week deltas, so anything phrased as "more than last
 * week" would be invented. What it does carry is `recent_badges[].earned_at`,
 * which is the one dated achievement signal, plus streak, mastery and session
 * timestamps. So this is a ladder of claims ordered by how much each one
 * actually means, and every rung is backed by a field that exists.
 *
 * It lives in its own module because the page should read as layout, and
 * because "which sentence do we show?" is the part most likely to be argued
 * about and revised — arguing about it in a 340-line component is worse.
 */

export type HeadlineTone = 'win' | 'steady' | 'quiet' | 'invite'

/** Split into three parts rather than returned as one string with markup:
 *  the emphasis is the clause the eye should land on, and the caller colours
 *  it. Slicing a Persian string by index to re-find a substring is how you
 *  get a bidi bug. */
export interface Headline {
  before: string
  emphasis: string
  after: string
  tone: HeadlineTone
}

const DAY = 86_400_000

/** How much each badge is worth as a headline. A first story outranks a
 *  seventh consecutive day, which outranks "tried today" — effort badges are
 *  real, but they are not the thing a parent is waiting to hear. */
const BADGE_RANK: Record<BadgeKey, number> = {
  first_story: 100,
  all_alphabet: 95,
  streak_7: 90,
  stories_3: 80,
  words_25: 75,
  first_lesson: 70,
  lessons_5: 60,
  words_10: 55,
  streak_3: 50,
  practiced_again: 30,
  tried_today: 20,
}

/** One sentence per badge, phrased as something the child DID — not as the
 *  badge's own title. «داستان‌خوان!» is a reward for the child; the parent
 *  wants the event that caused it. */
function badgeSentence(key: BadgeKey, name: string): Omit<Headline, 'tone'> | null {
  switch (key) {
    case 'first_story':
      return { before: `${name} این هفته `, emphasis: 'اولین داستانش را تا آخر خواند', after: '.' }
    case 'all_alphabet':
      return { before: `${name} `, emphasis: 'همه‌ی حروف الفبا را یاد گرفت', after: '.' }
    case 'streak_7':
      return { before: `${name} `, emphasis: 'یک هفته‌ی کامل بدون وقفه', after: ' تمرین کرد.' }
    case 'stories_3':
      return { before: `${name} این هفته `, emphasis: 'سه داستان را تا آخر خواند', after: '.' }
    case 'words_25':
      return { before: `${name} `, emphasis: 'بیست‌وپنج کلمه‌ی فارسی', after: ' را یاد گرفته.' }
    case 'first_lesson':
      return { before: `${name} `, emphasis: 'اولین درسش را تمام کرد', after: '.' }
    case 'lessons_5':
      return { before: `${name} این هفته `, emphasis: 'پنج درس را تمام کرد', after: '.' }
    case 'words_10':
      return { before: `${name} `, emphasis: 'ده کلمه‌ی فارسی', after: ' را یاد گرفته.' }
    case 'streak_3':
      return { before: `${name} `, emphasis: 'سه روز پشت‌سرهم', after: ' سراغ فارسی آمد.' }
    case 'practiced_again':
      return { before: `${name} این هفته `, emphasis: 'چیزی را که بلد نبود دوباره تمرین کرد', after: '.' }
    case 'tried_today':
      return { before: `${name} `, emphasis: 'امروز هم سراغ فارسی آمد', after: '.' }
    default:
      return null
  }
}

/**
 * Pick the truest thing we can say about the last week.
 * @param now injectable so the 7-day window is testable and so a render at
 *        midnight doesn't depend on when the module was imported.
 */
export function buildHeadline(summary: DashboardSummary, now: number = Date.now()): Headline {
  const name = summary.child.name
  const weekAgo = now - 7 * DAY

  // 1. A dated achievement inside the window. The strongest claim available,
  //    because it is an event with a timestamp rather than a running total.
  const fresh = summary.recent_badges
    .filter(cb => {
      const t = Date.parse(cb.earned_at)
      return Number.isFinite(t) && t >= weekAgo && t <= now
    })
    .map(cb => ({ cb, rank: cb.badge ? (BADGE_RANK[cb.badge.key] ?? 0) : 0 }))
    .filter(x => x.rank > 0)
    .sort((a, b) => b.rank - a.rank || Date.parse(b.cb.earned_at) - Date.parse(a.cb.earned_at))[0]

  if (fresh?.cb.badge) {
    const s = badgeSentence(fresh.cb.badge.key, name)
    if (s) return { ...s, tone: fresh.rank >= 70 ? 'win' : 'steady' }
  }

  // 2. Habit. Below three days it isn't a habit yet, so we don't call it one.
  if (summary.streak_days >= 3) {
    return {
      before: `${name} `,
      emphasis: `${fa(summary.streak_days)} روز پشت‌سرهم`,
      after: ' سراغ فارسی آمده.',
      tone: summary.streak_days >= 7 ? 'win' : 'steady',
    }
  }

  // 3. Durable learning. `mastered + consolidated` is specifically the count
  //    that survived spaced repetition — «یاد گرفته» would overclaim if it
  //    included words merely introduced once.
  const known = (summary.mastery_breakdown?.mastered ?? 0) + (summary.mastery_breakdown?.consolidated ?? 0)
  if (known > 0) {
    return {
      before: `${name} حالا `,
      emphasis: `${fa(known)} کلمه`,
      after: ' را بدون کمک می‌شناسد.',
      tone: 'steady',
    }
  }

  // 4. Showed up, but nothing has stuck yet. Still true, and worth saying —
  //    a parent who reads "nothing happened" on an active week closes the app.
  const active = summary.recent_sessions.some(s => {
    const t = Date.parse(s.started_at)
    return Number.isFinite(t) && t >= weekAgo
  })
  if (active) {
    return { before: `${name} `, emphasis: 'این هفته سراغ فارسی آمد', after: ' — هنوز اول راه است.', tone: 'quiet' }
  }

  // 5. Has history, but it stopped. The one place this page is allowed to be
  //    slightly uncomfortable: softening it into praise would be a lie, and
  //    the parent is the only person who can restart the habit.
  if (summary.words_learned > 0 || summary.lessons_completed > 0) {
    return {
      before: `${name} `,
      emphasis: 'این هفته سراغ فارسی نیامد',
      after: ' — یک قصه‌ی کوتاه برای شروع دوباره کافی است.',
      tone: 'quiet',
    }
  }

  // 6. Nothing yet. An invitation, not a zero.
  return { before: '', emphasis: `اولین قصه منتظر ${name} است`, after: '.', tone: 'invite' }
}

/** Persian-Indic digits. The headline is a Persian sentence; Latin numerals
 *  inside it force a bidi run change mid-clause and read as foreign. */
export function fa(n: number | string): string {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}
