'use client'
import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild, setActiveChildId } from '@/lib/activeChild'
import { containerWidths } from '@/components/shared/layout'
import { enterChildMode } from '@/lib/mode'
import { resolveLevel } from '@koodakbook/shared'
import type { DashboardSummary, Child, ChildSession } from '@koodakbook/shared'
import { Panel, Stat, FlatBar } from '@/components/parent/flat'
import { buildHeadline, fa } from '@/lib/parentHeadline'
import Mascot from '@/components/child/Mascot'

/* ── The parent dashboard ───────────────────────────────────────────────────
 *
 * Re-cut around one idea: a parent opens this to answer "is this working?",
 * and the previous version answered it with nine equal-weight cards, twelve
 * numbers, and minutes counted twice. Equal weight is the same as no weight.
 *
 * So the page now has a spine:
 *   1. A SENTENCE. What happened this week, in words, built from data that can
 *      actually support the claim (see lib/parentHeadline.ts).
 *   2. THREE numbers, not twelve — stories, words that stuck, days in a row.
 *      Minutes-in-app is deliberately not one of them: it rewards the wrong
 *      behaviour, and a parent optimising for it is optimising for screen time
 *      rather than reading.
 *   3. ONE action.
 *   4. Everything else, demoted below a divider, for the parent who wants it.
 *
 * Register: flat (components/parent/flat.tsx), never `.clay`. The child app's
 * pressable, coloured material would read as unserious to the person paying.
 */

function buildWeekHeatmap(sessions: ChildSession[]) {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - i))
    const dateStr = d.toDateString()
    const daySessions = sessions.filter(s => new Date(s.started_at).toDateString() === dateStr)
    const totalMin = daySessions.reduce((sum, s) => sum + Math.round((s.duration_sec ?? 0) / 60), 0)
    return { date: d, totalMin }
  })
}

/* Intensity now comes off the brand ramp instead of an ad-hoc amber-200/400/600
 * scale, so the one place this page uses colour as data uses the same stops
 * everything else does.
 *
 * The empty day returns a CLASS, not a `var(--color-parent-bg)` inline style:
 * `--color-parent-*` lives in `@theme inline`, where Tailwind only emits the
 * custom property if the CSS itself references it — a var() built in JS is
 * invisible to the scanner and would silently resolve to nothing. The ramps are
 * safe here because they are declared as real `--ramp-*` literals in :root
 * exactly so runtime var() works. */
function intensityCell(min: number): { className: string; style?: CSSProperties } {
  if (min === 0) return { className: 'bg-parent-bg border border-border' }
  if (min < 5) return { className: '', style: { background: 'var(--ramp-brand-soft)' } }
  if (min < 15) return { className: '', style: { background: 'var(--ramp-brand-bright)' } }
  return { className: '', style: { background: 'var(--ramp-brand-deep)' } }
}

const SHORT_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

/** The eyebrow above the sentence. Tone comes from the headline so the framing
 *  and the claim can never disagree — no «این هفته عالی بود» over a sentence
 *  that says nobody opened the app. */
const EYEBROW: Record<string, string> = {
  win: 'این هفته',
  steady: 'این هفته',
  quiet: 'این هفته',
  invite: 'شروع کنید',
}

export default function ParentDashboardPage() {
  const router = useRouter()
  const [children, setChildren] = useState<Child[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadSummary(childId: string) {
    const dashRes = await api.get<DashboardSummary>(`/api/dashboard/${childId}`)
    if (dashRes.data) setSummary(dashRes.data)
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const childRes = await api.get<Child[]>('/api/children')
      const list = childRes.data ?? []
      setChildren(list)
      const child = pickChild(list)
      if (!child) { setLoading(false); return }
      await loadSummary(child.id)
      setLoading(false)
    }
    load()
  }, [router])

  function switchChild(id: string) {
    setActiveChildId(id)
    setLoading(true)
    loadSummary(id).finally(() => setLoading(false))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-parent-bg">
      <div className="text-parent-muted persian-text">در حال بارگذاری...</div>
    </div>
  )

  if (!summary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 bg-parent-bg">
        <Mascot size={110} mood="happy" />
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-parent-text">سیمرغ منتظر همراهش است</h1>
          <p className="text-parent-muted font-medium mt-1.5 persian-text">یک پروفایل برای فرزندتان بسازید تا اولین قصه شروع شود</p>
        </div>
        <Link
          href="/onboarding"
          className="btn-brand font-bold py-3 px-6 rounded-xl transition-colors min-h-[48px] flex items-center"
        >
          ایجاد پروفایل
        </Link>
      </div>
    )
  }

  const {
    child, streak_days, words_learned, stories_completed, lessons_completed,
    recent_badges, recent_sessions, xp, mastery_breakdown,
  } = summary

  const heatmap = buildWeekHeatmap(recent_sessions)
  const todayMin = heatmap[heatmap.length - 1]?.totalMin ?? 0
  const goalMin = typeof window !== 'undefined' ? parseInt(localStorage.getItem('koodakbook_daily_goal_min') ?? '10') : 10
  const goalPct = Math.min(100, Math.round((todayMin / goalMin) * 100))
  const goalMet = todayMin >= goalMin
  const lvl = resolveLevel(xp ?? 0)
  const headline = buildHeadline(summary)

  /* Words that survived spaced repetition, not words merely seen once. This is
   * the number the headline claims, so the tile has to agree with it. */
  const knownWords = (mastery_breakdown?.mastered ?? 0) + (mastery_breakdown?.consolidated ?? 0)

  return (
    <div className={`min-h-screen bg-parent-bg pb-20 ${containerWidths.wide}`}>

      {/* Header */}
      <div className="bg-parent-surface border-b border-border px-5 py-4 lg:rounded-b-none">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl text-parent-text">داشبورد والدین</h1>
            <p className="text-sm text-parent-muted mt-0.5">{child.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/parent/friends"
              aria-label="دوستان"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-parent-muted hover:text-parent-text hover:bg-parent-bg transition-colors"
            >
              <Icon name="partner" size="lg" />
            </Link>
            <Link
              href="/parent/share"
              aria-label="کارت پیشرفت برای اشتراک‌گذاری"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-parent-muted hover:text-parent-text hover:bg-parent-bg transition-colors"
            >
              <Icon name="share" size="lg" />
            </Link>
            <Link
              href="/parent/settings"
              aria-label="تنظیمات"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-parent-muted hover:text-parent-text hover:bg-parent-bg transition-colors"
            >
              <Icon name="settings" size="lg" />
            </Link>
          </div>
        </div>

        {/* Child switcher */}
        {children.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1" role="tablist" aria-label="انتخاب کودک">
            {children.map(c => (
              <button
                key={c.id}
                role="tab"
                aria-selected={c.id === child.id}
                onClick={() => switchChild(c.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  c.id === child.id ? 'btn-brand' : 'bg-parent-bg text-parent-muted hover:bg-surface-subtle'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 lg:px-6 pt-5">

        {/* ── The answer ──────────────────────────────────────────────────────
            One panel, full width, carrying the sentence, the three numbers and
            the single action. Nothing competes with it above the fold. */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
          className="bg-parent-surface border border-border rounded-2xl shadow-card p-5 lg:p-6"
          aria-labelledby="headline"
        >
          <p className="text-xs font-bold tracking-wide text-parent-muted uppercase">
            {EYEBROW[headline.tone]}
          </p>

          {/* The emphasis is a separate span, not a substring match — slicing a
              Persian string by index to re-find a clause is how bidi bugs get in. */}
          <h2 id="headline" className="mt-2 text-xl lg:text-2xl font-bold text-parent-text leading-[1.7] text-balance">
            {headline.before}
            <span style={{ color: 'var(--ramp-brand-ink)', background: 'var(--ramp-brand-soft)' }} className="rounded px-1.5 py-0.5 box-decoration-clone">
              {headline.emphasis}
            </span>
            {headline.after}
          </h2>

          {/* Three numbers. Stories first: finishing a story is the outcome the
              product exists for, and the one a parent recognises without being
              taught how to read the metric. */}
          <div className="flex flex-wrap gap-3 mt-5">
            <Stat ramp="stories" icon="stories" emoji="📖" value={fa(stories_completed)} label="داستان تا آخر خوانده" />
            <Stat ramp="write" icon="write" emoji="✅" value={fa(knownWords)} label="کلمه که بدون کمک می‌شناسد" />
            <Stat ramp="phonics" icon="streak" emoji="🔥" value={fa(streak_days)} label="روز پشت‌سرهم" />
          </div>

          {/* Level / XP — the illustrated banner from f94794e is back (Phase 5),
              on the saffron brand gradient with DARK ink rather than the old
              white-on-violet that failed WCAG AA (--color-on-brand: 8.97:1 on
              #FBBF24, 5.34:1 on #F97316). The track and fill are the same warm
              ink at low/full opacity so the whole banner stays one hue. */}
          <div className="mt-5 rounded-2xl p-4 bg-brand-gradient-br text-on-brand">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-bold">سطح: {lvl.label}</span>
              <span className="text-sm font-bold tabular-nums">{fa(xp ?? 0)} امتیاز</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={lvl.pct}
              aria-label={`پیشرفت سطح: ${lvl.pct} درصد`}
              className="h-2.5 rounded-full overflow-hidden"
              style={{ background: 'rgb(69 26 3 / 0.18)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--color-on-brand)' }}
                initial={{ width: 0 }}
                animate={{ width: `${lvl.pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
            <p className="text-xs opacity-80 mt-1.5">
              {lvl.isMax ? 'بالاترین سطح 🌟' : `${fa(lvl.toNext)} امتیاز تا سطح بعد`}
            </p>
          </div>

          {/* One action. It points at the progress card for now; when the
              grandparent voice-reply loop lands this becomes "send the
              recording", which is the actual retention mechanism. Shipping that
              button today would ship a button with nothing behind it. */}
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <Link
              href="/parent/share"
              className="flex-1 flex items-center justify-center gap-2 btn-brand font-bold py-3.5 rounded-xl transition-colors min-h-[52px]"
            >
              <Icon name="share" size="md" />
              کارت پیشرفت را برای خانواده بفرست
            </Link>
            {children.length > 0 && (
              <button
                onClick={() => { enterChildMode({ pick: true }); router.push('/child/home') }}
                className="sm:w-auto flex items-center justify-center gap-2 px-5 border border-border text-parent-text font-bold py-3.5 rounded-xl hover:bg-surface-subtle transition-colors min-h-[52px]"
              >
                حالت کودک
              </button>
            )}
          </div>
        </motion.section>

        {/* ── The detail ──────────────────────────────────────────────────────
            Below the fold on a phone, and labelled as detail. A parent who
            wants to audit gets everything; a parent who wanted the answer has
            already left. */}
        <h2 className="text-xs font-bold tracking-wide text-parent-muted uppercase mt-8 mb-3 px-1">
          جزئیات
        </h2>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 lg:items-start">

          {/* Consistency — the heatmap, plus the daily minutes goal folded in.
              Minutes are DEMOTED, not deleted: `koodakbook_daily_goal_min` is a
              setting the parent can still edit in /parent/settings, and removing
              the only place it is displayed would orphan it. It just no longer
              gets to be a headline number. */}
          <Panel title="پیوستگی ۷ روز اخیر" labelledById="heatmap-title">
            <div className="flex gap-2 justify-between">
              {heatmap.map((day, i) => {
                const cell = intensityCell(day.totalMin)
                return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <motion.div
                    role="img"
                    className={`w-9 h-9 rounded-xl ${cell.className}`}
                    style={cell.style}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.04, duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
                    aria-label={`${SHORT_DAYS[(day.date.getDay() + 1) % 7]}: ${day.totalMin} دقیقه`}
                  />
                  <span className="text-xs text-parent-muted">
                    {SHORT_DAYS[(day.date.getDay() + 1) % 7]}
                  </span>
                </div>
                )
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-parent-muted">هدف امروز</span>
              <span className={`text-xs font-bold tabular-nums ${goalMet ? 'text-green-700' : 'text-parent-text'}`}>
                {goalMet
                  ? <span className="inline-flex items-center gap-1.5"><Icon name="doneCircle" size="xs" />انجام شد</span>
                  : `${fa(todayMin)} از ${fa(goalMin)} دقیقه`}
              </span>
            </div>
            <FlatBar
              className="mt-2"
              value={goalPct}
              ramp={goalMet ? 'lessons' : 'brand'}
              label={`هدف روزانه: ${goalPct} درصد`}
            />
          </Panel>

          {/* Word mastery breakdown (mig-016) */}
          {mastery_breakdown && (() => {
            const total = mastery_breakdown.introduced + mastery_breakdown.practicing + mastery_breakdown.mastered + mastery_breakdown.consolidated
            if (total === 0) return null
            const segs = [
              { key: 'consolidated', label: 'تثبیت‌شده', count: mastery_breakdown.consolidated, fill: 'var(--ramp-lessons-deep)' },
              { key: 'mastered', label: 'یاد گرفته', count: mastery_breakdown.mastered, fill: 'var(--ramp-lessons-bright)' },
              { key: 'practicing', label: 'در حال تمرین', count: mastery_breakdown.practicing, fill: 'var(--ramp-brand-bright)' },
              { key: 'introduced', label: 'معرفی شده', count: mastery_breakdown.introduced, fill: '#A8998A' },
            ]
            return (
              <Panel
                title="تسلط بر کلمه‌ها"
                labelledById="mastery-title"
                action={<span className="text-xs text-parent-muted tabular-nums">{fa(total)} کلمه</span>}
              >
                <div className="flex h-2.5 rounded-full overflow-hidden mb-3" role="img" aria-label="نمودار تسلط بر کلمه‌ها">
                  {segs.filter(s => s.count > 0).map(s => (
                    <div key={s.key} style={{ width: `${(s.count / total) * 100}%`, background: s.fill }} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {segs.map(s => (
                    <div key={s.key} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.fill }} aria-hidden="true" />
                      <span className="text-parent-muted">{s.label}</span>
                      <span className="text-parent-text font-medium ms-auto tabular-nums">{fa(s.count)}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )
          })()}

          {/* Totals that didn't make the top three. They're real, they're just
              not the answer to "is this working?". */}
          <Panel title="مجموع" labelledById="totals-title">
            <dl className="divide-y divide-border">
              {[
                { label: 'کلمه‌های دیده‌شده', value: words_learned },
                { label: 'درس‌های تمام‌شده', value: lessons_completed },
                { label: 'امتیاز', value: xp ?? 0 },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                  <dt className="text-parent-muted">{row.label}</dt>
                  <dd className="font-bold text-parent-text tabular-nums">{fa(row.value)}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* Recent badges */}
          {recent_badges.length > 0 && (
            <Panel title="جوایز اخیر" labelledById="badges-title">
              <ul className="space-y-2">
                {recent_badges.slice(0, 5).map(cb => (
                  <li key={cb.id} className="flex items-center gap-2.5 text-sm">
                    <span style={{ color: 'var(--ramp-rewards-ink)' }}><Icon name="rewards" size="sm" /></span>
                    <span className="text-parent-text font-medium">{cb.badge?.title}</span>
                    <span className="text-xs text-parent-muted ms-auto tabular-nums">
                      {new Date(cb.earned_at).toLocaleDateString('fa-IR')}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Recent sessions */}
          {recent_sessions.length > 0 && (
            <Panel title="جلسات اخیر" labelledById="sessions-title">
              <ul className="space-y-2">
                {recent_sessions.slice(0, 5).map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-parent-text">{new Date(s.started_at).toLocaleDateString('fa-IR')}</span>
                    <span className="text-parent-muted tabular-nums">
                      {s.duration_sec ? `${fa(Math.round(s.duration_sec / 60))} دقیقه` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Link
            href="/parent/progress"
            className="flex items-center justify-center gap-2 w-full bg-parent-surface hover:bg-surface-subtle border border-border text-parent-text font-bold py-4 rounded-xl transition-colors min-h-[52px]"
          >
            <Icon name="progress" size="md" />
            گزارش کامل پیشرفت
          </Link>
        </div>
      </div>
    </div>
  )
}
