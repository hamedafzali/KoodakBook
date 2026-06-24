'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LineChart, BarList, Donut, CohortHeatmap } from '@/components/charts'

interface Stats { users: number; children: number; words: number; stories: number; lessons: number }
interface Overview {
  growth: { date: string; signups: number; active: number }[]
  funnel: { children: number; placement: number; lesson: number; story: number; activated: number }
  cohorts: { week: string; size: number; retention: (number | null)[] }[]
  plans: { plan: string; count: number }[]
  content: {
    hardest_words: { persian: string; english: string; avg_replay: number; learners: number }[]
    top_words: { persian: string; english: string; learners: number }[]
    stories: { title: string; started: number; completed: number }[]
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [ov, setOv] = useState<Overview | null>(null)

  useEffect(() => {
    api.get<Stats>('/api/admin/stats').then(r => { if (r.data) setStats(r.data) })
    api.get<Overview>('/api/admin/analytics/overview').then(r => { if (r.data) setOv(r.data) })
  }, [])

  const cards = [
    { label: 'خانواده‌ها', value: stats?.users, emoji: '👨‍👩‍👧' },
    { label: 'کودکان', value: stats?.children, emoji: '👶' },
    { label: 'کلمات', value: stats?.words, emoji: '📝' },
    { label: 'داستان‌ها', value: stats?.stories, emoji: '📖' },
    { label: 'درس‌ها', value: stats?.lessons, emoji: '📚' },
  ]

  const f = ov?.funnel
  const funnelItems = f ? [
    { label: 'ثبت‌نام (کودک)', value: f.children },
    { label: 'ارزیابی اولیه', value: f.placement },
    { label: 'اولین درس', value: f.lesson },
    { label: 'اولین داستان', value: f.story },
    { label: 'خواندن داستان واقعی (فعال‌سازی)', value: f.activated },
  ] : []

  const planColors: Record<string, string> = { premium: '#7c3aed', free: '#cbd5e1' }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">داشبورد</h2>

      {/* Count tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <div className="text-2xl mb-1">{c.emoji}</div>
            <div className="text-2xl font-bold text-gray-800">{c.value ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="رشد (۳۰ روز اخیر)">
          {ov ? (
            <>
              <LineChart series={[
                { name: 'signups', color: '#f59e0b', points: ov.growth.map(g => g.signups) },
                { name: 'active', color: '#10b981', points: ov.growth.map(g => g.active) },
              ]} />
              <div className="flex gap-4 text-xs mt-2">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> ثبت‌نام</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> کودک فعال</span>
              </div>
            </>
          ) : <Loading />}
        </Panel>

        <Panel title="قیف فعال‌سازی">
          {ov ? <BarList items={funnelItems} color="#f59e0b" /> : <Loading />}
        </Panel>

        <Panel title="ماندگاری هفتگی (کوهورت)">
          {ov ? <CohortHeatmap cohorts={ov.cohorts} /> : <Loading />}
        </Panel>

        <Panel title="توزیع پلن">
          {ov ? <Donut slices={ov.plans.map(p => ({ label: p.plan, value: p.count, color: planColors[p.plan] ?? '#94a3b8' }))} /> : <Loading />}
        </Panel>

        <Panel title="سخت‌ترین واژه‌ها (بیشترین تکرار)">
          {ov ? <BarList color="#ef4444" suffix="×"
            items={ov.content.hardest_words.map(w => ({ label: `${w.persian} (${w.english})`, value: w.avg_replay, sub: `${w.learners} کودک` }))} /> : <Loading />}
        </Panel>

        <Panel title="تکمیل داستان‌ها">
          {ov ? <BarList color="#3b82f6"
            items={ov.content.stories.map(s => ({ label: s.title, value: s.completed, sub: `از ${s.started} شروع` }))} /> : <Loading />}
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <h3 className="font-bold text-gray-700 text-sm mb-3">{title}</h3>
      {children}
    </div>
  )
}
function Loading() { return <p className="text-gray-400 text-sm">در حال بارگذاری...</p> }
