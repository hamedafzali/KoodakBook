'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { PageHeader, Badge, Spinner, EmptyState } from '@/components/ui'

interface Lead {
  id: string
  type: 'tablet' | 'app_waitlist' | 'contact'
  name: string | null
  email: string
  phone: string | null
  country: string | null
  quantity: number | null
  message: string | null
  status: 'new' | 'contacted' | 'closed'
  created_at: string
}

const TYPE_LABEL: Record<Lead['type'], string> = {
  tablet: '🖥 تبلت', app_waitlist: '📱 اپ موبایل', contact: '✉️ تماس',
}
const STATUS: { id: Lead['status']; label: string; tone: 'blue' | 'amber' | 'gray' }[] = [
  { id: 'new', label: 'جدید', tone: 'blue' },
  { id: 'contacted', label: 'تماس گرفته شد', tone: 'amber' },
  { id: 'closed', label: 'بسته', tone: 'gray' },
]
const FILTERS = [
  { id: '', label: 'همه' },
  { id: 'tablet', label: 'تبلت' },
  { id: 'app_waitlist', label: 'اپ موبایل' },
  { id: 'contact', label: 'تماس' },
]

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async (type: string) => {
    const r = await api.get<Lead[]>(`/api/leads/admin/list${type ? `?type=${type}` : ''}`)
    if (r.data) setLeads(r.data)
  }, [])
  useEffect(() => { load(filter) }, [filter, load])

  async function setStatus(id: string, status: Lead['status']) {
    const r = await api.patch<Lead>(`/api/leads/admin/${id}`, { status })
    if (r.data) setLeads(ls => (ls ?? []).map(l => (l.id === id ? r.data! : l)))
  }

  if (!leads) return <Spinner />

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="درخواست‌ها" subtitle="پیش‌سفارش تبلت، فهرست انتظار اپ موبایل و پیام‌های سایت" />

      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`text-sm px-4 py-1.5 rounded-xl border transition ${
              filter === f.id ? 'bg-amber-500 border-amber-500 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {leads.length === 0 ? (
        <EmptyState>هنوز درخواستی ثبت نشده است.</EmptyState>
      ) : (
        <div className="space-y-3">
          {leads.map(l => {
            const st = STATUS.find(s => s.id === l.status)!
            return (
              <div key={l.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-700">{TYPE_LABEL[l.type]}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="text-xs text-slate-400">{new Date(l.created_at).toLocaleDateString('fa-IR')}</span>
                  </div>
                  <select value={l.status} onChange={e => setStatus(l.id, e.target.value as Lead['status'])}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                    {STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
                  {l.name && <p>👤 {l.name}</p>}
                  <p dir="ltr" className="text-left sm:text-right">✉️ {l.email}</p>
                  {l.phone && <p dir="ltr" className="text-left sm:text-right">📞 {l.phone}</p>}
                  {l.country && <p>🌍 {l.country}</p>}
                  {l.quantity != null && l.quantity > 1 && <p>🔢 تعداد: {l.quantity}</p>}
                </div>
                {l.message && <p className="mt-2 text-sm text-slate-500 bg-slate-50 rounded-xl px-3 py-2">{l.message}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
