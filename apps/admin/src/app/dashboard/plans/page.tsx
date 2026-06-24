'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

interface Plan {
  id: string; key: string; name: string; description: string | null
  price_cents: number; currency: string; interval: 'month' | 'year' | 'none'
  trial_days: number; is_active: boolean; is_default: boolean; sort: number
  subscribers: number; features: Record<string, string>
}

const money = (c: number, cur: string) => (c === 0 ? 'رایگان' : `${(c / 100).toFixed(2)} ${cur}`)
const INTERVAL: Record<string, string> = { month: 'ماهانه', year: 'سالانه', none: '—' }

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const r = await api.get<Plan[]>('/api/admin/plans')
    if (r.data) setPlans(r.data)
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">پلن‌ها</h2>
        <button onClick={() => setCreating(v => !v)} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm">
          {creating ? 'بستن' : '+ پلن جدید'}
        </button>
      </div>

      {creating && <PlanEditor onSaved={() => { setCreating(false); load() }} />}

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map(p => <PlanCard key={p.id} plan={p} onChange={load} />)}
      </div>
    </div>
  )
}

function PlanCard({ plan, onChange }: { plan: Plan; onChange: () => void }) {
  const [edit, setEdit] = useState(false)
  async function del() {
    if (!confirm(`پلن «${plan.name}» حذف شود؟`)) return
    const r = await api.delete(`/api/admin/plans/${plan.id}`)
    if (r.error) alert(r.error); else onChange()
  }
  if (edit) return <div className="md:col-span-2"><PlanEditor plan={plan} onSaved={() => { setEdit(false); onChange() }} onCancel={() => setEdit(false)} /></div>
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-gray-800">{plan.name} <span className="text-xs text-gray-400 ltr">({plan.key})</span></p>
          <p className="text-sm text-gray-500">{money(plan.price_cents, plan.currency)} · {INTERVAL[plan.interval]}{plan.trial_days ? ` · ${plan.trial_days} روز آزمایشی` : ''}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {plan.is_default && <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">پیش‌فرض</span>}
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${plan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{plan.is_active ? 'فعال' : 'غیرفعال'}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {Object.entries(plan.features).map(([k, v]) => (
          <span key={k} className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded ltr">{k}={v}</span>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-400">{plan.subscribers} مشترک</span>
        <div className="flex gap-2">
          <button onClick={() => setEdit(true)} className="text-xs text-amber-700 hover:underline">ویرایش</button>
          <button onClick={del} className="text-xs text-red-500 hover:underline">حذف</button>
        </div>
      </div>
    </div>
  )
}

function PlanEditor({ plan, onSaved, onCancel }: { plan?: Plan; onSaved: () => void; onCancel?: () => void }) {
  const [f, setF] = useState({
    key: plan?.key ?? '', name: plan?.name ?? '', description: plan?.description ?? '',
    price_cents: plan?.price_cents ?? 0, currency: plan?.currency ?? 'EUR',
    interval: plan?.interval ?? 'month', trial_days: plan?.trial_days ?? 0,
    is_active: plan?.is_active ?? true, is_default: plan?.is_default ?? false,
  })
  const [feats, setFeats] = useState<[string, string][]>(Object.entries(plan?.features ?? {}))
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setErr(null)
    const features = Object.fromEntries(feats.filter(([k]) => k.trim()))
    const body = { ...f, price_cents: Number(f.price_cents), trial_days: Number(f.trial_days), features }
    const r = plan ? await api.patch(`/api/admin/plans/${plan.id}`, body) : await api.post('/api/admin/plans', body)
    if (r.error) { setErr(r.error); return }
    onSaved()
  }
  const inp = 'border border-gray-300 rounded-xl px-3 py-2 text-sm w-full'

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3 border-2 border-amber-200">
      <div className="grid grid-cols-2 gap-3">
        <Field label="کلید (شناسه یکتا)" hint={plan ? 'غیرقابل تغییر' : 'مثلاً premium_year'}>
          <input className={inp} placeholder="premium_year" dir="ltr" value={f.key} disabled={!!plan} onChange={e => setF({ ...f, key: e.target.value })} />
        </Field>
        <Field label="نام نمایشی">
          <input className={inp} placeholder="پرمیوم" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="قیمت (به سنت)" hint="۹۹۹ = ۹٫۹۹">
          <input className={inp} type="number" value={f.price_cents} onChange={e => setF({ ...f, price_cents: +e.target.value })} />
        </Field>
        <Field label="دوره">
          <select className={inp} value={f.interval} onChange={e => setF({ ...f, interval: e.target.value as 'month' | 'year' | 'none' })}>
            <option value="month">ماهانه</option><option value="year">سالانه</option><option value="none">بدون دوره</option>
          </select>
        </Field>
        <Field label="روزهای آزمایشی رایگان">
          <input className={inp} type="number" value={f.trial_days} onChange={e => setF({ ...f, trial_days: +e.target.value })} />
        </Field>
        <Field label="واحد پول">
          <input className={inp} dir="ltr" value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} />
        </Field>
      </div>
      <Field label="توضیحات">
        <input className={inp} placeholder="توضیح کوتاه پلن" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      </Field>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} /> فعال</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.is_default} onChange={e => setF({ ...f, is_default: e.target.checked })} /> پلن پیش‌فرض</label>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">ویژگی‌ها / محدودیت‌ها</p>
        <p className="text-xs text-gray-400 mb-2">هر ویژگی یک کلید و یک مقدار دارد (مثلاً <span className="ltr">max_children = 5</span>).</p>
        {feats.length > 0 && (
          <div className="flex gap-2 mb-1 text-xs text-gray-400">
            <span className="flex-1">کلید ویژگی</span><span className="flex-1">مقدار</span><span className="w-7" />
          </div>
        )}
        {feats.map(([k, v], i) => (
          <div key={i} className="flex gap-2 mb-1.5">
            <input className={inp} placeholder="max_children" dir="ltr" value={k} onChange={e => { const c = [...feats]; c[i] = [e.target.value, v]; setFeats(c) }} />
            <input className={inp} placeholder="5 / true" dir="ltr" value={v} onChange={e => { const c = [...feats]; c[i] = [k, e.target.value]; setFeats(c) }} />
            <button onClick={() => setFeats(feats.filter((_, j) => j !== i))} className="text-red-400 px-2" aria-label="حذف ویژگی">✕</button>
          </div>
        ))}
        <button onClick={() => setFeats([...feats, ['', '']])} className="text-xs text-amber-700 hover:underline">+ افزودن ویژگی</button>
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2 rounded-xl text-sm">ذخیره</button>
        {onCancel && <button onClick={onCancel} className="text-gray-500 px-4 py-2 text-sm">انصراف</button>}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">
        {label}{hint && <span className="text-gray-400 font-normal"> · {hint}</span>}
      </span>
      {children}
    </label>
  )
}
