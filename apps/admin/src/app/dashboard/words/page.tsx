'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import FileUpload from '@/components/FileUpload'
import type { Word } from '@koodakbook/shared'
import { WORD_CATEGORIES, ANIMATION_TEMPLATES, templateForCategory, TEMPLATE_REGISTRY } from '@koodakbook/shared'

const CATEGORIES = WORD_CATEGORIES as readonly string[]
const EMPTY = {
  persian: '', english: '', finglish: '', category: 'animals', stage: 1,
  audio_url: '', image_url: '', animation_template: '', animation_params: '',
}

export default function AdminWordsPage() {
  const [words, setWords] = useState<Word[]>([])
  const [form, setForm] = useState({ ...EMPTY })
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    const res = await api.get<Word[]>('/api/admin/words')
    if (res.data) setWords(res.data)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    let animation_params: unknown = undefined
    if (form.animation_params.trim()) {
      try { animation_params = JSON.parse(form.animation_params) }
      catch { alert('پارامترهای انیمیشن باید JSON معتبر باشند'); return }
    }
    const payload = {
      ...form,
      stage: Number(form.stage),
      audio_url: form.audio_url || null,
      image_url: form.image_url || null,
      animation_template: form.animation_template || null,
      animation_params,
    }
    if (editing) {
      await api.patch(`/api/admin/words/${editing}`, payload)
    } else {
      await api.post('/api/admin/words', payload)
    }
    setForm({ ...EMPTY }); setEditing(null); load()
  }

  async function handleDelete(id: string) {
    if (!confirm('حذف شود؟')) return
    await api.delete(`/api/admin/words/${id}`)
    load()
  }

  function startEdit(w: Word) {
    setEditing(w.id)
    setForm({
      persian: w.persian, english: w.english, finglish: w.finglish ?? '',
      category: w.category, stage: w.stage, audio_url: w.audio_url ?? '', image_url: w.image_url ?? '',
      animation_template: w.animation_template ?? '',
      animation_params: w.animation_params && Object.keys(w.animation_params).length
        ? JSON.stringify(w.animation_params, null, 2) : '',
    })
  }

  const filtered = filter === 'all' ? words : words.filter(w => w.category === filter)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">مدیریت کلمات</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-700">{editing ? 'ویرایش کلمه' : 'افزودن کلمه جدید'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">فارسی *</label>
            <input required value={form.persian} onChange={e => setForm(f => ({ ...f, persian: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">English *</label>
            <input required value={form.english} onChange={e => setForm(f => ({ ...f, english: e.target.value }))}
              className="ltr w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Finglish</label>
            <input value={form.finglish} onChange={e => setForm(f => ({ ...f, finglish: e.target.value }))}
              className="ltr w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">دسته‌بندی *</label>
            <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">مرحله</label>
            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: Number(e.target.value) }))}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              {[1,2,3,4].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">قالب انیمیشن</label>
            <select value={form.animation_template} onChange={e => setForm(f => ({ ...f, animation_template: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="">— (پیش‌فرض: {templateForCategory(form.category as never)})</option>
              {ANIMATION_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">پارامترهای انیمیشن</label>
          <AnimationParams
            template={(form.animation_template || templateForCategory(form.category as never)) as string}
            value={form.animation_params}
            onChange={json => setForm(f => ({ ...f, animation_params: json }))}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUpload type="audio" label="فایل صوتی" currentUrl={form.audio_url}
            onUploaded={url => setForm(f => ({ ...f, audio_url: url }))} />
          <FileUpload type="images" label="تصویر" currentUrl={form.image_url}
            onUploaded={url => setForm(f => ({ ...f, image_url: url }))} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-6 rounded-xl text-sm transition">
            {editing ? 'ذخیره' : 'افزودن'}
          </button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY }) }}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-xl text-sm transition">
            انصراف
          </button>}
        </div>
      </form>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === c ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border hover:border-amber-300'}`}>
            {c === 'all' ? 'همه' : c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-right px-4 py-3">فارسی</th>
              <th className="text-left px-4 py-3">English</th>
              <th className="px-4 py-3">دسته</th>
              <th className="px-4 py-3">صدا</th>
              <th className="px-4 py-3">تصویر</th>
              <th className="px-4 py-3">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(w => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-bold">{w.persian}</td>
                <td className="px-4 py-3 ltr text-gray-500">{w.english}</td>
                <td className="px-4 py-3 text-center"><span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">{w.category}</span></td>
                <td className="px-4 py-3 text-center">{w.audio_url ? '🔊' : '—'}</td>
                <td className="px-4 py-3 text-center">{w.image_url ? '🖼' : '—'}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => startEdit(w)} className="text-amber-600 hover:underline text-xs ml-3">ویرایش</button>
                  <button onClick={() => handleDelete(w.id)} className="text-red-500 hover:underline text-xs">حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">کلمه‌ای یافت نشد</p>}
      </div>
    </div>
  )
}

// Friendly per-param editor (replaces raw JSON). Renders one labeled field per
// param the selected animation template accepts (from TEMPLATE_REGISTRY).
const NUMERIC = (n: string) => n.endsWith('_ms') || n.endsWith('_pct') || ['squash', 'count_to', 'density', 'repeat_count', 'stagger_ms'].includes(n)
const BOOLEAN = (n: string) => ['glow', 'jump', 'tail_swish', 'fill_sweep', 'diacritic_overlay', 'bounce'].includes(n)
const humanize = (n: string) => n.replace(/_/g, ' ')

function AnimationParams({ template, value, onChange }: { template: string; value: string; onChange: (json: string) => void }) {
  let obj: Record<string, unknown> = {}
  try { obj = value ? JSON.parse(value) : {} } catch { obj = {} }
  const params = (TEMPLATE_REGISTRY as Record<string, { params: string[] }>)[template]?.params ?? []

  function set(k: string, v: unknown) {
    const next: Record<string, unknown> = { ...obj }
    if (v === '' || v === undefined || v === null) delete next[k]
    else next[k] = v
    onChange(Object.keys(next).length ? JSON.stringify(next) : '')
  }

  if (params.length === 0) return <p className="text-xs text-gray-400">این قالب پارامتری ندارد.</p>
  return (
    <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-xl p-3">
      {params.map(p => {
        const v = obj[p]
        if (BOOLEAN(p)) return (
          <label key={p} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 text-sm border border-gray-200">
            <span className="ltr text-gray-600 text-xs">{humanize(p)}</span>
            <input type="checkbox" checked={v === true} onChange={e => set(p, e.target.checked || undefined)} />
          </label>
        )
        return (
          <label key={p} className="block">
            <span className="block text-[11px] text-gray-500 mb-0.5 ltr">{humanize(p)}</span>
            <input type={NUMERIC(p) ? 'number' : 'text'} step="any"
              value={v === undefined || v === null ? '' : String(v)}
              onChange={e => set(p, e.target.value === '' ? undefined : (NUMERIC(p) ? Number(e.target.value) : e.target.value))}
              className="ltr w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white" />
          </label>
        )
      })}
    </div>
  )
}
