'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'

interface ChildRow {
  id: string; name: string; birth_year: number | null; level: number; placement_done: boolean
  created_at: string; words_mastered: number; lessons_done: number; stories_done: number; last_active: string | null
}
interface Parent { id: string; email: string; plan: string; plan_expires_at: string | null; created_at: string }
interface FamilyResp { user: Parent; children: ChildRow[] }
interface PlanOpt { key: string; name: string; is_active: boolean }

const fa = (d: string | null) => (d ? new Date(d).toLocaleDateString('fa-IR') : '—')

export default function FamilyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<FamilyResp | null>(null)
  const [plan, setPlan] = useState<string>('free')
  const [planOpts, setPlanOpts] = useState<PlanOpt[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [temp, setTemp] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await api.get<FamilyResp>(`/api/admin/users/${id}`)
    if (r.data) { setData(r.data); setPlan(r.data.user.plan) }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { api.get<PlanOpt[]>('/api/admin/plans').then(r => { if (r.data) setPlanOpts(r.data.filter(p => p.is_active)) }) }, [])

  async function savePlan() {
    setMsg(null)
    const r = await api.patch(`/api/admin/users/${id}/plan`, { plan })
    setMsg(r.error ? `خطا: ${r.error}` : 'پلن ذخیره شد ✓')
    load()
  }
  async function resetPw() {
    setTemp(null)
    const r = await api.post<{ temp_password: string }>(`/api/admin/users/${id}/reset-password`, {})
    if (r.data) setTemp(r.data.temp_password)
  }
  async function del() {
    if (!confirm('کل خانواده و همه‌ی داده‌هایش حذف شود؟ این عمل برگشت‌ناپذیر است.')) return
    const r = await api.delete(`/api/admin/users/${id}`)
    if (!r.error) router.push('/dashboard/users')
    else alert(r.error)
  }

  if (!data) return <p className="text-gray-400">در حال بارگذاری...</p>
  const u = data.user

  return (
    <div className="space-y-5">
      <Link href="/dashboard/users" className="text-sm text-amber-700 hover:underline">→ همه‌ی کاربران</Link>

      {/* Parent card */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 ltr">{u.email}</h2>
        <p className="text-xs text-gray-400 mt-1">عضویت: {fa(u.created_at)}</p>

        <div className="flex flex-wrap items-end gap-3 mt-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">پلن</label>
            <select value={plan} onChange={e => setPlan(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm">
              {planOpts.map(p => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}
              {planOpts.length === 0 && <option value={plan}>{plan}</option>}
            </select>
          </div>
          <button onClick={savePlan} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm">ذخیره پلن</button>
          <button onClick={resetPw} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-sm">بازنشانی رمز</button>
          <button onClick={del} className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-sm ms-auto">حذف خانواده</button>
        </div>
        {msg && <p className="text-sm mt-3 text-green-700">{msg}</p>}
        {temp && (
          <p className="text-sm mt-3 bg-amber-50 text-amber-800 rounded-xl p-3">
            رمز موقت (یک‌بار نمایش، به والد بدهید): <b className="ltr">{temp}</b>
          </p>
        )}
      </div>

      {/* Children */}
      <div>
        <h3 className="font-bold text-gray-700 mb-3">کودکان ({data.children.length})</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {data.children.map(c => (
            <Link key={c.id} href={`/dashboard/children/${c.id}`}
              className="bg-white rounded-2xl shadow-sm p-4 hover:ring-2 hover:ring-amber-200 transition">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-800">{c.name}</p>
                <span className="text-xs text-gray-400">مرحله {c.level}{c.placement_done ? '' : ' · بدون ارزیابی'}</span>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>📝 {c.words_mastered} کلمه</span>
                <span>📚 {c.lessons_done} درس</span>
                <span>📖 {c.stories_done} داستان</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">آخرین فعالیت: {fa(c.last_active)}</p>
            </Link>
          ))}
          {data.children.length === 0 && <p className="text-gray-400 text-sm">کودکی ثبت نشده</p>}
        </div>
      </div>
    </div>
  )
}
