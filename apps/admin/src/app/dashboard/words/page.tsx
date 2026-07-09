'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import FileUpload from '@/components/FileUpload'
import type { Word } from '@koodakbook/shared'
import { WORD_CATEGORIES, ANIMATION_TEMPLATES, templateForCategory, TEMPLATE_REGISTRY } from '@koodakbook/shared'
import { PageHeader, Button, ui } from '@/components/ui'

const CATEGORIES = WORD_CATEGORIES as readonly string[]
const EMPTY = {
  persian: '', english: '', finglish: '', category: 'animals', stage: 1,
  tts_text: '', audio_url: '', image_url: '', animation_template: '', animation_params: '',
}

export default function AdminWordsPage() {
  const [words, setWords] = useState<Word[]>([])
  const [form, setForm] = useState({ ...EMPTY })
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [genBusy, setGenBusy] = useState<string | null>(null)

  /** Voice ONE word (free or premium tier) — for newly added words, no batch. */
  async function genAudio(id: string, tier: 'free' | 'premium') {
    setGenBusy(id)
    const r = await api.post<{ url: string }>(`/api/admin/audio/word/${id}`, { tier })
    setGenBusy(null)
    if (r.error) { alert(r.error); return }
    load()
  }

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
      tts_text: form.tts_text.trim() || null,
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
      category: w.category, stage: w.stage, tts_text: w.tts_text ?? '',
      audio_url: w.audio_url ?? '', image_url: w.image_url ?? '',
      animation_template: w.animation_template ?? '',
      animation_params: w.animation_params && Object.keys(w.animation_params).length
        ? JSON.stringify(w.animation_params, null, 2) : '',
    })
  }

  const filtered = filter === 'all' ? words : words.filter(w => w.category === filter)

  return (
    <div className="space-y-6">
      <PageHeader title="مدیریت کلمات" subtitle="افزودن و ویرایش واژگان" />

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-700">{editing ? 'ویرایش کلمه' : 'افزودن کلمه جدید'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">فارسی *</label>
            <input required value={form.persian} onChange={e => setForm(f => ({ ...f, persian: e.target.value }))}
              className={ui.input} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">English *</label>
            <input required value={form.english} onChange={e => setForm(f => ({ ...f, english: e.target.value }))}
              className={`ltr ${ui.input}`} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Finglish</label>
            <input value={form.finglish} onChange={e => setForm(f => ({ ...f, finglish: e.target.value }))}
              className={`ltr ${ui.input}`} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">دسته‌بندی *</label>
            <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className={ui.input}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">مرحله</label>
            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: Number(e.target.value) }))}
              className={ui.input}>
              {[1,2,3,4].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">تلفظ برای صدا (اِعراب‌گذاری‌شده)</label>
            <input value={form.tts_text} onChange={e => setForm(f => ({ ...f, tts_text: e.target.value }))}
              placeholder={form.persian ? `مثلاً ${form.persian} با اِعراب` : 'مثلاً کِرم'}
              className={ui.input} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">قالب انیمیشن</label>
            <select value={form.animation_template} onChange={e => setForm(f => ({ ...f, animation_template: e.target.value }))}
              className={ui.input}>
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
          <div>
            <FileUpload type="images" label="تصویر" currentUrl={form.image_url}
              onUploaded={url => setForm(f => ({ ...f, image_url: url }))} />
            <PhotoPicker query={form.english} onPicked={url => setForm(f => ({ ...f, image_url: url }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit">{editing ? 'ذخیره' : 'افزودن'}</Button>
          {editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm({ ...EMPTY }) }}>انصراف</Button>}
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
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span title={w.audio_url ? 'صدای رایگان دارد' : 'بدون صدای رایگان'}>{w.audio_url ? '🔊' : '—'}</span>
                  <span className="mx-0.5" title={w.audio_url_premium ? 'صدای پرمیوم دارد' : 'بدون صدای پرمیوم'}>{w.audio_url_premium ? '⭐' : ''}</span>
                </td>
                <td className="px-4 py-3 text-center">{w.image_url ? '🖼' : '—'}</td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <button onClick={() => genAudio(w.id, 'free')} disabled={genBusy !== null}
                    title="ساخت صدای رایگان همین کلمه"
                    className="text-slate-500 hover:text-amber-600 text-xs ml-2 disabled:opacity-40">
                    {genBusy === w.id ? '…' : '🔊 ساخت'}
                  </button>
                  <button onClick={() => genAudio(w.id, 'premium')} disabled={genBusy !== null}
                    title="ساخت صدای پرمیوم همین کلمه"
                    className="text-slate-500 hover:text-amber-600 text-xs ml-3 disabled:opacity-40">
                    ⭐ ساخت
                  </button>
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

/* ── Free-photo picker (Pixabay/Pexels when keys are set, Openverse fallback) ──
 * Searches by an editable query (prefilled with the word's English gloss —
 * refine it when results miss, e.g. "bear" → "brown bear animal"). The admin
 * picks one; the backend downloads it into /uploads (never hotlinked). */
function PhotoPicker({ query, onPicked }: { query: string; onPicked: (url: string) => void }) {
  const [q, setQ] = useState(query)
  const [results, setResults] = useState<{ id: string; thumb: string; url: string; license: string; source: string }[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)   // 'search' | result id
  const [err, setErr] = useState<string | null>(null)

  // Follow the word being edited until the admin starts typing their own query.
  useEffect(() => { setQ(query); setResults(null); setErr(null) }, [query])

  async function search() {
    if (!q.trim()) { setErr('عبارت جست‌وجو را بنویسید (انگلیسی بهترین نتیجه را می‌دهد)'); return }
    setBusy('search'); setErr(null); setResults(null)
    const r = await api.get<{ id: string; thumb: string; url: string; license: string; source: string }[]>(
      `/api/admin/images/search?q=${encodeURIComponent(q.trim())}`)
    setBusy(null)
    if (r.error || !r.data) { setErr(r.error ?? 'خطا'); return }
    if (r.data.length === 0) { setErr('عکسی پیدا نشد — عبارت دیگری امتحان کنید') ; return }
    setResults(r.data)
  }

  async function pick(item: { id: string; url: string }) {
    setBusy(item.id); setErr(null)
    const r = await api.post<{ url: string }>('/api/admin/images/import', { url: item.url })
    setBusy(null)
    if (r.error || !r.data) { setErr(r.error ?? 'دانلود ممکن نشد'); return }
    onPicked(r.data.url)
    setResults(null)
  }

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} dir="ltr"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
          placeholder="brown bear animal"
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
        <button type="button" onClick={search} disabled={busy === 'search'}
          className="text-xs bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-lg hover:bg-amber-200 disabled:opacity-50 whitespace-nowrap">
          {busy === 'search' ? '…' : '🔍 عکس رایگان'}
        </button>
      </div>
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      {results && (
        <div className="grid grid-cols-4 gap-2 mt-2 max-h-64 overflow-y-auto pr-1">
          {results.map(x => (
            <button key={x.id} type="button" onClick={() => pick(x)} disabled={busy !== null}
              className={`relative rounded-lg overflow-hidden border-2 hover:border-amber-400 transition ${busy === x.id ? 'opacity-50' : 'border-transparent'}`}
              title={`${x.source} — ${x.license}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.thumb} alt="" className="w-full h-16 object-cover" loading="lazy" />
              <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[9px] text-center leading-4">{x.source}</span>
              {busy === x.id && <span className="absolute inset-0 flex items-center justify-center text-xs bg-white/70">⬇</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
