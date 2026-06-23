'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface RetentionWeek { week: number; eligible: number; active: number; rate: number | null }
interface PilotMetrics {
  families: number
  children: number
  placement_done: number
  activation: { count: number; rate: number | null }
  retention: RetentionWeek[]
  engagement: {
    avg_words_mastered: number
    avg_lessons_completed: number
    avg_stories_completed: number
    avg_session_min: number
    total_sessions: number
    active_last_7d: number
  }
  literacy_gain: { measured_children: number; avg_level_gain: number | null }
}

const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`)

/** Gate chip: green if the rate meets the §11.5 target, amber otherwise. */
function Gate({ rate, target, label }: { rate: number | null; target: number; label: string }) {
  const pass = rate != null && rate >= target
  return (
    <div className={`rounded-2xl p-5 text-center ${pass ? 'bg-green-50' : 'bg-amber-50'}`}>
      <div className={`text-3xl font-bold ${pass ? 'text-green-700' : 'text-amber-700'}`}>{pct(rate)}</div>
      <div className="text-xs text-gray-600 mt-1">{label}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">هدف ≥ {Math.round(target * 100)}% {pass ? '✅' : ''}</div>
    </div>
  )
}

export default function PilotPage() {
  const [m, setM] = useState<PilotMetrics | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.get<PilotMetrics>('/api/admin/pilot-metrics')
      .then(r => { if (r.data) setM(r.data); else setErr(r.error ?? 'خطا') })
  }, [])

  if (err) return <p className="text-red-500">{err}</p>
  if (!m) return <p className="text-gray-400">در حال بارگذاری...</p>

  const w4 = m.retention.find(r => r.week === 4)
  const eng = m.engagement

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-1">پایلوت — معیارهای موفقیت</h2>
      <p className="text-sm text-gray-500 mb-6">
        {m.families} خانواده · {m.children} کودک · {m.placement_done} ارزیابی اولیه انجام‌شده
      </p>

      {/* Gates (§11.5) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Gate rate={m.activation.rate} target={0.6} label={`فعال‌سازی — داستان واقعی خواند (${m.activation.count})`} />
        <Gate rate={w4?.rate ?? null} target={0.4} label={`ماندگاری هفته ۴ (${w4?.active ?? 0}/${w4?.eligible ?? 0})`} />
        <div className="rounded-2xl p-5 text-center bg-blue-50">
          <div className="text-3xl font-bold text-blue-700">{m.literacy_gain.avg_level_gain ?? '—'}</div>
          <div className="text-xs text-gray-600 mt-1">میانگین رشد سطح</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{m.literacy_gain.measured_children} کودک (pre/post)</div>
        </div>
      </div>

      {/* Weekly retention */}
      <h3 className="font-bold text-gray-700 mb-3">ماندگاری هفتگی</h3>
      <div className="grid grid-cols-4 gap-3 mb-8">
        {m.retention.map(r => (
          <div key={r.week} className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-gray-800">{pct(r.rate)}</div>
            <div className="text-xs text-gray-500 mt-1">هفته {r.week}</div>
            <div className="text-[11px] text-gray-400">{r.active}/{r.eligible}</div>
          </div>
        ))}
      </div>

      {/* Engagement */}
      <h3 className="font-bold text-gray-700 mb-3">درگیری و یادگیری</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'میانگین کلمه یادگرفته', value: eng.avg_words_mastered },
          { label: 'میانگین درس تمام‌شده', value: eng.avg_lessons_completed },
          { label: 'میانگین داستان خوانده', value: eng.avg_stories_completed },
          { label: 'میانگین دقیقه هر جلسه', value: eng.avg_session_min },
          { label: 'کل جلسات', value: eng.total_sessions },
          { label: 'فعال در ۷ روز اخیر', value: eng.active_last_7d },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <div className="text-3xl font-bold text-gray-800">{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
