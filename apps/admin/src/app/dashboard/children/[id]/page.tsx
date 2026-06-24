'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'

interface Drill {
  child: { id: string; parent_id: string; name: string; birth_year: number | null; level: number; placement_done: boolean; created_at: string }
  mastery_breakdown: { introduced: number; practicing: number; mastered: number; consolidated: number }
  strand_levels: { strand: string; level: number; source: string }[]
  lessons_completed: number
  stories_completed: number
  recent_sessions: { started_at: string; duration_sec: number | null }[]
  badges: { earned_at: string; title: string; key: string }[]
  placement_history: { level: number; strand_levels: Record<string, number>; taken_at: string }[]
  words: { mastery: string; persian: string; english: string }[]
}

const fa = (d: string | null) => (d ? new Date(d).toLocaleDateString('fa-IR') : '—')
const MASTERY_LABEL: Record<string, string> = { consolidated: 'تثبیت‌شده', mastered: 'یاد گرفته', practicing: 'در حال تمرین', introduced: 'معرفی شده' }
const MASTERY_COLOR: Record<string, string> = { consolidated: 'bg-emerald-100 text-emerald-700', mastered: 'bg-green-100 text-green-700', practicing: 'bg-amber-100 text-amber-700', introduced: 'bg-gray-100 text-gray-500' }
const STRAND_LABEL: Record<string, string> = { P: 'آوایی', D: 'رمزگشایی', V: 'واژگان', F: 'روانی', C: 'درک مطلب' }

export default function ChildDrillPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Drill | null>(null)

  const load = useCallback(async () => {
    const r = await api.get<Drill>(`/api/admin/children/${id}`)
    if (r.data) setD(r.data)
  }, [id])
  useEffect(() => { load() }, [load])

  if (!d) return <p className="text-gray-400">در حال بارگذاری...</p>
  const mb = d.mastery_breakdown
  const totalWords = mb.introduced + mb.practicing + mb.mastered + mb.consolidated

  return (
    <div className="space-y-5">
      <Link href={`/dashboard/users/${d.child.parent_id}`} className="text-sm text-amber-700 hover:underline">→ خانواده</Link>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800">{d.child.name}</h2>
        <p className="text-xs text-gray-400 mt-1">
          مرحله {d.child.level} · {d.child.birth_year ? `تولد ${d.child.birth_year}` : 'بدون سال تولد'} ·
          {d.child.placement_done ? ' ارزیابی انجام‌شده' : ' بدون ارزیابی'} · عضویت {fa(d.child.created_at)}
        </p>
      </div>

      {/* Strand levels */}
      <Section title="سطح مهارت‌ها">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['P','D','V','F','C']).map(s => {
            const row = d.strand_levels.find(x => x.strand === s)
            return (
              <div key={s} className="bg-white rounded-xl shadow-sm p-3 text-center">
                <div className="text-2xl font-bold text-gray-800">{row?.level ?? d.child.level}</div>
                <div className="text-xs text-gray-500 mt-0.5">{STRAND_LABEL[s]}</div>
                {row && <div className="text-[10px] text-gray-300 mt-0.5">{row.source}</div>}
              </div>
            )
          })}
        </div>
      </Section>

      {/* Mastery + counts */}
      <Section title={`تسلط بر واژگان (${totalWords})`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {(['consolidated','mastered','practicing','introduced']).map(k => (
            <div key={k} className={`rounded-xl p-3 text-center ${MASTERY_COLOR[k]}`}>
              <div className="text-2xl font-bold">{mb[k as keyof typeof mb]}</div>
              <div className="text-xs mt-0.5">{MASTERY_LABEL[k]}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 text-sm text-gray-600">
          <span>📚 {d.lessons_completed} درس تمام‌شده</span>
          <span>📖 {d.stories_completed} داستان خوانده</span>
          <span>🏆 {d.badges.length} جایزه</span>
        </div>
      </Section>

      {/* Placement history (literacy gain) */}
      {d.placement_history.length > 0 && (
        <Section title="تاریخچه‌ی ارزیابی (رشد سطح)">
          <div className="flex flex-wrap gap-2 text-sm">
            {d.placement_history.map((h, i) => (
              <span key={i} className="bg-blue-50 text-blue-700 rounded-lg px-3 py-1">
                {fa(h.taken_at)}: سطح {h.level}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Recent sessions */}
      <Section title="جلسات اخیر">
        <div className="space-y-1.5">
          {d.recent_sessions.slice(0, 10).map((s, i) => (
            <div key={i} className="flex justify-between text-sm text-gray-600">
              <span>{fa(s.started_at)}</span>
              <span className="text-gray-400">{s.duration_sec ? `${Math.round(s.duration_sec / 60)} دقیقه` : '—'}</span>
            </div>
          ))}
          {d.recent_sessions.length === 0 && <p className="text-gray-400 text-sm">جلسه‌ای ثبت نشده</p>}
        </div>
      </Section>

      {/* Words */}
      <Section title={`واژگان (${d.words.length})`}>
        <div className="flex flex-wrap gap-2">
          {d.words.map((w, i) => (
            <span key={i} className={`px-2.5 py-1 rounded-lg text-sm ${MASTERY_COLOR[w.mastery] ?? 'bg-gray-100 text-gray-500'}`}
              title={`${w.english} — ${MASTERY_LABEL[w.mastery] ?? w.mastery}`}>
              {w.persian}
            </span>
          ))}
          {d.words.length === 0 && <p className="text-gray-400 text-sm">هنوز واژه‌ای تمرین نشده</p>}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-bold text-gray-700 mb-2 text-sm">{title}</h3>
      {children}
    </section>
  )
}
