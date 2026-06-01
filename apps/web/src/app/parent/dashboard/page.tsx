'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import type { DashboardSummary, Child } from '@koodakbook/shared'

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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">در حال بارگذاری...</div>

  if (!summary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-amber-50">
        <div className="text-6xl">👶</div>
        <p className="text-gray-600 font-medium text-center">هنوز پروفایل کودکی ایجاد نشده</p>
        <Link href="/onboarding" className="bg-amber-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-amber-600 transition">
          ایجاد پروفایل
        </Link>
      </div>
    )
  }

  const { child, streak_days, words_learned, stories_completed, lessons_completed, recent_badges } = summary

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl text-gray-800">داشبورد والدین</h1>
          <p className="text-sm text-gray-500">{child.name}</p>
        </div>
        <Link href="/parent/settings" className="text-gray-400 hover:text-gray-600 text-2xl">⚙️</Link>
      </div>

      <div className="px-4 pt-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard emoji="🔥" value={streak_days}        label="روز متوالی"      color="bg-orange-50 border-orange-200" />
          <StatCard emoji="📝" value={words_learned}      label="کلمه یاد گرفته"  color="bg-blue-50 border-blue-200" />
          <StatCard emoji="📖" value={stories_completed}  label="داستان خوانده"   color="bg-green-50 border-green-200" />
          <StatCard emoji="✅" value={lessons_completed}  label="درس تموم شده"    color="bg-purple-50 border-purple-200" />
        </div>

        {recent_badges.length > 0 && (
          <section className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-3">جوایز اخیر</h2>
            <div className="flex gap-3 flex-wrap">
              {recent_badges.map(cb => (
                <div key={cb.id} className="flex flex-col items-center gap-1 bg-amber-50 rounded-xl p-3 text-center">
                  <span className="text-3xl">🏆</span>
                  <span className="text-xs font-medium text-gray-700">{cb.badge?.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {summary.recent_sessions.length > 0 && (
          <section className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-3">جلسات اخیر</h2>
            <div className="space-y-2">
              {summary.recent_sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{new Date(s.started_at).toLocaleDateString('fa-IR')}</span>
                  <span className="text-gray-400">{s.duration_sec ? `${Math.round(s.duration_sec / 60)} دقیقه` : '—'}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <Link href="/parent/progress"
          className="block w-full text-center bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-700 font-bold py-4 rounded-2xl transition">
          گزارش کامل پیشرفت 📊
        </Link>

        <Link href="/child/home"
          className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl transition text-lg">
          رفتن به حالت کودک 👶
        </Link>
      </div>
    </div>
  )
}

function StatCard({ emoji, value, label, color }: { emoji: string; value: number; label: string; color: string }) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-3xl">{emoji}</span>
      <span className="text-3xl font-bold text-gray-800">{value}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  )
}
