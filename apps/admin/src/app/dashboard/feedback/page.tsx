'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader, Button, Badge, Card, Input, Select, Spinner, EmptyState } from '@/components/ui'
import { Segmented } from '@/components/report'
import { Icon } from '@/components/icons'
import { downloadCsv, fa } from '@/lib/csv'

/* Family feedback inbox (routes/feedback.ts, migration 068).
 * Messages come from the website contact form (no account) and the parent
 * area on web and mobile (signed in). A reply to a signed-in family is shown
 * to them in their parent area; a website message is answered by email. */

type Status = 'new' | 'in_progress' | 'answered' | 'closed'
type Kind = 'idea' | 'problem' | 'question' | 'other'
interface Item {
  id: string
  user_id: string | null
  source: 'site' | 'parent_web' | 'parent_mobile'
  kind: Kind
  name: string | null
  email: string | null
  message: string
  context: Record<string, string | number | boolean>
  status: Status
  admin_note: string | null
  reply: string | null
  replied_at: string | null
  replied_by: string | null
  reply_seen_at: string | null
  created_at: string
  user_plan: string | null
  children: number
}

const STATUS_LABEL: Record<Status, string> = { new: 'تازه', in_progress: 'در حال بررسی', answered: 'پاسخ داده شد', closed: 'بسته' }
const STATUS_TONE: Record<Status, 'amber' | 'blue' | 'green' | 'gray'> = { new: 'amber', in_progress: 'blue', answered: 'green', closed: 'gray' }
const KIND_LABEL: Record<Kind, string> = { idea: 'پیشنهاد', problem: 'مشکل', question: 'سؤال', other: 'پیام' }
const KIND_TONE: Record<Kind, 'violet' | 'red' | 'blue' | 'gray'> = { idea: 'violet', problem: 'red', question: 'blue', other: 'gray' }
const SOURCE_LABEL: Record<Item['source'], string> = { site: 'سایت', parent_web: 'والدین · وب', parent_mobile: 'والدین · اپ' }
const CONTEXT_LABEL: Record<string, string> = { screen: 'صفحه', platform: 'پلتفرم', app_version: 'نسخه‌ی اپ', os: 'سیستم‌عامل', browser: 'مرورگر', user_agent: 'مرورگر', locale: 'زبان' }

const when = (iso: string) => new Date(iso).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' })

export default function FeedbackInbox() {
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [kind, setKind] = useState<Kind | ''>('')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[] | null>(null)
  const [counts, setCounts] = useState<Partial<Record<Status, number>>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    if (kind) params.set('kind', kind)
    if (q.trim()) params.set('q', q.trim())
    api.get<{ items: Item[]; counts: Partial<Record<Status, number>> }>(`/api/admin/feedback?${params}`).then(r => {
      if (r.error || !r.data) { setError(r.error ?? 'بارگذاری نشد'); return }
      setError(null); setItems(r.data.items); setCounts(r.data.counts)
    })
  }, [status, kind, q])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])

  const selected = useMemo(() => items?.find(i => i.id === selectedId) ?? null, [items, selectedId])
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const onUpdated = (row: Item) => setItems(list => list?.map(i => (i.id === row.id ? { ...i, ...row } : i)) ?? null)

  return (
    <div className="space-y-4 max-w-7xl">
      <PageHeader title="بازخورد خانواده‌ها" subtitle="پیام‌های فرم تماس سایت و بخش والدین (وب و اپ)"
        actions={<Button variant="secondary" disabled={!items?.length} onClick={() => items && downloadCsv('feedback.csv',
          items.map(i => ({ date: i.created_at, kind: i.kind, source: i.source, status: i.status, email: i.email, name: i.name, message: i.message })))}>
          <Icon name="download" size={14} /> CSV</Button>} />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="وضعیت" value={status} onChange={setStatus} options={[
          { value: 'all', label: `همه (${fa(total)})` },
          { value: 'new', label: `تازه (${fa(counts.new ?? 0)})` },
          { value: 'in_progress', label: `در حال بررسی (${fa(counts.in_progress ?? 0)})` },
          { value: 'answered', label: `پاسخ‌داده (${fa(counts.answered ?? 0)})` },
          { value: 'closed', label: `بسته (${fa(counts.closed ?? 0)})` },
        ]} />
        <Select value={kind} onChange={e => setKind(e.target.value as Kind | '')} className="!w-40" aria-label="نوع">
          <option value="">همه‌ی انواع</option>
          {(Object.keys(KIND_LABEL) as Kind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </Select>
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در متن، ایمیل یا نام" className="!w-64" aria-label="جستجو" />
      </div>

      {error && <div className="bg-rose-50 text-rose-700 text-sm rounded-xl p-3" role="alert">{error}</div>}

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        <Card className="lg:col-span-2 overflow-hidden">
          {!items ? <Spinner /> : items.length === 0 ? <EmptyState>پیامی نیست</EmptyState> : (
            <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {items.map(i => (
                <li key={i.id}>
                  <button type="button" onClick={() => setSelectedId(i.id)}
                    className={`w-full text-right p-3 flex flex-col gap-1 transition ${selectedId === i.id ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-2 text-[11px]">
                      {i.status === 'new' && <span className="w-2 h-2 rounded-full bg-amber-500" aria-label="تازه" />}
                      <Badge tone={KIND_TONE[i.kind]}>{KIND_LABEL[i.kind]}</Badge>
                      <Badge tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                      <span className="text-slate-400 ms-auto">{when(i.created_at)}</span>
                    </div>
                    <p className={`text-sm line-clamp-2 ${i.status === 'new' ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}>{i.message}</p>
                    <p className="text-[11px] text-slate-400 truncate">{i.name ? `${i.name} · ` : ''}<span dir="ltr">{i.email}</span> · {SOURCE_LABEL[i.source]}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="lg:col-span-3">
          {selected ? <Detail key={selected.id} item={selected} onUpdated={onUpdated} /> : (
            <Card className="p-8 text-center text-sm text-slate-400">یک پیام را از فهرست انتخاب کنید</Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ item, onUpdated }: { item: Item; onUpdated: (row: Item) => void }) {
  const [reply, setReply] = useState('')
  const [note, setNote] = useState(item.admin_note ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const patch = async (body: Record<string, unknown>, done: string) => {
    setBusy(true); setMsg(null)
    const r = await api.patch<Item>(`/api/admin/feedback/${item.id}`, body)
    setBusy(false)
    if (r.error || !r.data) { setMsg(r.error ?? 'ذخیره نشد'); return }
    onUpdated(r.data); setMsg(done)
  }

  const mailto = item.email
    ? `mailto:${item.email}?subject=${encodeURIComponent('پاسخ کودک‌بوک به پیام شما')}&body=${encodeURIComponent(`سلام${item.name ? ` ${item.name}` : ''}،\n\n\n\n— پیام شما:\n${item.message}`)}`
    : null
  const ctx = Object.entries(item.context ?? {})

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
        <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
        <span className="text-xs text-slate-400">{SOURCE_LABEL[item.source]} — {when(item.created_at)}</span>
      </div>

      <div className="text-sm text-slate-600 space-y-1">
        <p><span className="text-slate-400">از: </span>{item.name ? `${item.name} — ` : ''}<span dir="ltr">{item.email ?? '—'}</span></p>
        {item.user_id ? (
          <p className="flex items-center gap-2">
            <span className="text-slate-400">حساب: </span>
            <Link href={`/dashboard/users/${item.user_id}`} className="text-amber-700 hover:underline inline-flex items-center gap-1">
              پرونده‌ی خانواده <Icon name="external" size={12} /></Link>
            <span className="text-xs text-slate-400">پلن {item.user_plan ?? '—'}، {fa(item.children)} کودک</span>
          </p>
        ) : <p className="text-xs text-slate-400">بدون حساب کاربری (فرم سایت)</p>}
      </div>

      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-wrap leading-7">{item.message}</div>

      {ctx.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {ctx.map(([k, v]) => (
            <div key={k} className="flex gap-2 min-w-0">
              <dt className="text-slate-400 shrink-0">{CONTEXT_LABEL[k] ?? k}:</dt>
              <dd className="text-slate-600 truncate" dir="auto" title={String(v)}>{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700">پاسخ</h3>
        {item.reply && (
          <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-3 text-sm whitespace-pre-wrap">
            {item.reply}
            <p className="text-[11px] text-slate-500 mt-2">
              {item.replied_by} — {item.replied_at ? when(item.replied_at) : ''} — {item.reply_seen_at ? `خانواده دید (${when(item.reply_seen_at)})` : 'هنوز دیده نشده'}
            </p>
          </div>
        )}
        {item.user_id ? (
          <>
            <textarea value={reply} onChange={e => setReply(e.target.value)} rows={4} maxLength={2000}
              placeholder={item.reply ? 'پاسخ تازه (جایگزین پاسخ قبلی می‌شود)' : 'پاسخ شما در بخش والدین به این خانواده نشان داده می‌شود'}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !reply.trim()} onClick={() => patch({ reply: reply.trim() }, 'پاسخ فرستاده شد ✓').then(() => setReply(''))}>
                <Icon name="send" size={14} /> فرستادن پاسخ</Button>
              {mailto && <a href={mailto} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3"><Icon name="email" size={14} /> یا با ایمیل</a>}
            </div>
          </>
        ) : mailto ? (
          <a href={mailto} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2">
            <Icon name="email" size={14} /> پاسخ با ایمیل</a>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700">یادداشت داخلی <span className="text-xs font-normal text-slate-400">(خانواده نمی‌بیند)</span></h3>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={2000}
          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <Button variant="secondary" disabled={busy || note === (item.admin_note ?? '')} onClick={() => patch({ admin_note: note }, 'یادداشت ذخیره شد ✓')}>
          <Icon name="save" size={14} /> ذخیره‌ی یادداشت</Button>
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-400">وضعیت:</span>
        {(Object.keys(STATUS_LABEL) as Status[]).map(s => (
          <Button key={s} variant={item.status === s ? 'primary' : 'ghost'} disabled={busy || item.status === s}
            onClick={() => patch({ status: s }, 'وضعیت به‌روز شد ✓')}>{STATUS_LABEL[s]}</Button>
        ))}
      </div>
      {msg && <p className="text-xs text-slate-500" role="status">{msg}</p>}
    </Card>
  )
}
