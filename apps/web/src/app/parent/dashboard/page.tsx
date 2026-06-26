'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild, setActiveChildId } from '@/lib/activeChild'
import { resolveLevel } from '@koodakbook/shared'
import type { DashboardSummary, Child, ChildSession } from '@koodakbook/shared'

/* Build 7-day activity data from sessions */
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

function intensityClass(min: number) {
  if (min === 0) return 'bg-gray-100'
  if (min < 5)  return 'bg-amber-200'
  if (min < 15) return 'bg-amber-400'
  return 'bg-amber-600'
}

const SHORT_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-gray-400 persian-text">در حال بارگذاری...</div>
    </div>
  )

  if (!summary) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 bg-slate-50">
          <div className="text-6xl">👶</div>
          <p className="text-gray-600 font-medium text-center persian-text">هنوز پروفایل کودکی ایجاد نشده</p>
          <Link
            href="/onboarding"
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-[1.25rem] transition-colors min-h-[48px] flex items-center"
          >
            ایجاد پروفایل
          </Link>
        </div>
    )
  }

  const { child, streak_days, words_learned, stories_completed, lessons_completed, recent_badges, recent_sessions, xp, mastery_breakdown } = summary
  const heatmap = buildWeekHeatmap(recent_sessions)
  const todayMin = heatmap[heatmap.length - 1]?.totalMin ?? 0
  const goalMin = typeof window !== 'undefined' ? parseInt(localStorage.getItem('koodakbook_daily_goal_min') ?? '10') : 10
  const goalPct = Math.min(100, Math.round((todayMin / goalMin) * 100))
  const goalMet = todayMin >= goalMin
  const lvl = resolveLevel(xp ?? 0)

  return (
      <div className="min-h-screen bg-slate-50 pb-20">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-xl text-slate-800">داشبورد والدین</h1>
              <p className="text-sm text-slate-500 mt-0.5">{child.name}</p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/parent/share"
                aria-label="کارت پیشرفت برای اشتراک‌گذاری"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-2xl"
              >
                📤
              </Link>
              <Link
                href="/parent/settings"
                aria-label="تنظیمات"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-2xl"
              >
                ⚙️
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
                    c.id === child.id ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pt-5 space-y-5">

          {/* ── Level / XP ── */}
          <section className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-[1.25rem] p-4 shadow-sm text-white" aria-labelledby="level-title">
            <div className="flex items-center justify-between mb-2">
              <h2 id="level-title" className="font-bold text-sm">سطح: {lvl.label}</h2>
              <span className="text-sm font-bold">{xp ?? 0} XP</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={lvl.pct}
              aria-label={`پیشرفت سطح: ${lvl.pct} درصد`}
              className="h-3 bg-white/25 rounded-full overflow-hidden"
            >
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${lvl.pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
            <p className="text-xs text-white/80 mt-1.5">
              {lvl.isMax ? 'بالاترین سطح! 🌟' : `${lvl.toNext} XP تا سطح بعدی`}
            </p>
          </section>

          {/* ── Daily goal ── */}
          <section className="bg-white rounded-[1.25rem] p-4 shadow-sm" aria-labelledby="goal-title">
            <div className="flex items-center justify-between mb-2">
              <h2 id="goal-title" className="font-bold text-slate-700 text-sm">هدف امروز</h2>
              <span className={`text-sm font-bold ${goalMet ? 'text-green-600' : 'text-amber-600'}`}>
                {goalMet ? '✅ انجام شد' : `${todayMin} از ${goalMin} دقیقه`}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={goalPct}
              aria-label={`هدف روزانه: ${goalPct} درصد`}
              className="h-3 bg-slate-100 rounded-full overflow-hidden"
            >
              <motion.div
                className={`h-full rounded-full ${goalMet ? 'bg-green-500' : 'bg-amber-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${goalPct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </section>

          {/* ── 7-Day Activity Heatmap ── */}
          <section className="bg-white rounded-[1.25rem] p-4 shadow-sm" aria-labelledby="heatmap-title">
            <h2 id="heatmap-title" className="font-bold text-slate-700 text-sm mb-3">فعالیت ۷ روز اخیر</h2>
            <div className="flex gap-2 justify-between">
              {heatmap.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <motion.div
                    className={`w-9 h-9 rounded-xl ${intensityClass(day.totalMin)}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    title={`${day.totalMin} دقیقه`}
                    aria-label={`${SHORT_DAYS[(day.date.getDay() + 1) % 7]}: ${day.totalMin} دقیقه`}
                  />
                  <span className="text-xs text-slate-400">
                    {SHORT_DAYS[(day.date.getDay() + 1) % 7]}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-slate-400">کمتر</span>
              {['bg-gray-100','bg-amber-200','bg-amber-400','bg-amber-600'].map(c => (
                <div key={c} className={`w-4 h-4 rounded-sm ${c}`} />
              ))}
              <span className="text-xs text-slate-400">بیشتر</span>
            </div>
          </section>

          {/* ── Stats grid ── */}
          <section className="grid grid-cols-2 gap-3" aria-label="خلاصه پیشرفت">
            <StatCard emoji="🔥" value={streak_days}       label="روز متوالی"      color="bg-orange-50 border-orange-200" />
            <StatCard emoji="📝" value={words_learned}     label="کلمه یاد گرفته"  color="bg-blue-50 border-blue-200" />
            <StatCard emoji="📖" value={stories_completed} label="داستان خوانده"   color="bg-green-50 border-green-200" />
            <StatCard emoji="✅" value={lessons_completed}  label="درس تمام شده"   color="bg-purple-50 border-purple-200" />
          </section>

          {/* ── Word mastery breakdown (mig-016) ── */}
          {mastery_breakdown && (() => {
            const total = mastery_breakdown.introduced + mastery_breakdown.practicing + mastery_breakdown.mastered + mastery_breakdown.consolidated
            if (total === 0) return null
            const segs = [
              { key: 'consolidated', label: 'تثبیت‌شده',   count: mastery_breakdown.consolidated, bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
              { key: 'mastered',     label: 'یاد گرفته',    count: mastery_breakdown.mastered,     bar: 'bg-green-500',   dot: 'bg-green-500' },
              { key: 'practicing',   label: 'در حال تمرین', count: mastery_breakdown.practicing,   bar: 'bg-amber-400',   dot: 'bg-amber-400' },
              { key: 'introduced',   label: 'معرفی شده',    count: mastery_breakdown.introduced,   bar: 'bg-slate-300',   dot: 'bg-slate-300' },
            ]
            return (
              <section className="bg-white rounded-[1.25rem] p-4 shadow-sm" aria-labelledby="mastery-title">
                <div className="flex items-center justify-between mb-3">
                  <h2 id="mastery-title" className="font-bold text-slate-700 text-sm">تسلط بر کلمه‌ها</h2>
                  <span className="text-xs text-slate-400">{total} کلمه</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden mb-3" role="img" aria-label="نمودار تسلط بر کلمه‌ها">
                  {segs.filter(s => s.count > 0).map(s => (
                    <div key={s.key} className={s.bar} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {segs.map(s => (
                    <div key={s.key} className="flex items-center gap-2 text-xs">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} aria-hidden="true" />
                      <span className="text-slate-600">{s.label}</span>
                      <span className="text-slate-400 font-medium ms-auto">{s.count}</span>
                    </div>
                  ))}
                </div>
              </section>
            )
          })()}

          {/* ── Recent badges ── */}
          {recent_badges.length > 0 && (
            <section className="bg-white rounded-[1.25rem] p-4 shadow-sm" aria-labelledby="badges-title">
              <h2 id="badges-title" className="font-bold text-slate-700 mb-3 text-sm">جوایز اخیر</h2>
              <div className="flex gap-3 flex-wrap">
                {recent_badges.map(cb => (
                  <div key={cb.id} className="flex flex-col items-center gap-1 bg-amber-50 rounded-xl p-3 text-center">
                    <span className="text-3xl" aria-hidden="true">🏆</span>
                    <span className="text-xs font-medium text-slate-700">{cb.badge?.title}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Recent sessions ── */}
          {recent_sessions.length > 0 && (
            <section className="bg-white rounded-[1.25rem] p-4 shadow-sm" aria-labelledby="sessions-title">
              <h2 id="sessions-title" className="font-bold text-slate-700 mb-3 text-sm">جلسات اخیر</h2>
              <div className="space-y-2">
                {recent_sessions.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{new Date(s.started_at).toLocaleDateString('fa-IR')}</span>
                    <span className="text-slate-400">
                      {s.duration_sec ? `${Math.round(s.duration_sec / 60)} دقیقه` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Link
            href="/parent/progress"
            className="flex items-center justify-center w-full bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 font-bold py-4 rounded-[1.25rem] transition-colors min-h-[56px]"
          >
            گزارش کامل پیشرفت 📊
          </Link>

          <Link
            href="/child/home"
            className="flex items-center justify-center w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-[1.25rem] transition-colors text-lg min-h-[56px]"
          >
            رفتن به حالت کودک 👶
          </Link>
        </div>
      </div>
  )
}

function StatCard({ emoji, value, label, color }: { emoji: string; value: number; label: string; color: string }) {
  return (
    <div className={`rounded-[1.25rem] border p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-3xl" aria-hidden="true">{emoji}</span>
      <span className="text-3xl font-bold text-slate-800">{value}</span>
      <span className="text-xs text-slate-600">{label}</span>
    </div>
  )
}
