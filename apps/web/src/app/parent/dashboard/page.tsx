'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import ParentGate from '@/components/parent/ParentGate'
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
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const childRes = await api.get<Child[]>('/api/children')
      if (!childRes.data?.[0]) { setLoading(false); return }
      const dashRes = await api.get<DashboardSummary>(`/api/dashboard/${childRes.data[0].id}`)
      if (dashRes.data) setSummary(dashRes.data)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-gray-400 persian-text">در حال بارگذاری...</div>
    </div>
  )

  if (!summary) {
    return (
      <ParentGate>
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
      </ParentGate>
    )
  }

  const { child, streak_days, words_learned, stories_completed, lessons_completed, recent_badges, recent_sessions } = summary
  const heatmap = buildWeekHeatmap(recent_sessions)

  return (
    <ParentGate>
      <div className="min-h-screen bg-slate-50 pb-20">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-xl text-slate-800">داشبورد والدین</h1>
              <p className="text-sm text-slate-500 mt-0.5">{child.name}</p>
            </div>
            <Link
              href="/parent/settings"
              aria-label="تنظیمات"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-2xl"
            >
              ⚙️
            </Link>
          </div>
        </div>

        <div className="px-4 pt-5 space-y-5">

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
    </ParentGate>
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
