'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { containerWidths } from '@/components/shared/layout'
import { PageHeader, Panel } from '@/components/parent/flat'
import FeedbackForm from '@/components/shared/FeedbackForm'

/* «پیشنهاد، مشکل یا سؤال» — the parent area's line to the KoodakBook team
 * (backend routes/feedback.ts). The form sends with the account email; our
 * replies show up below under «پیام‌های من», so answering never needs email.
 * Opening this page marks new replies as read. */

interface Mine {
  id: string
  kind: 'idea' | 'problem' | 'question' | 'other'
  message: string
  status: 'new' | 'in_progress' | 'answered' | 'closed'
  reply: string | null
  replied_at: string | null
  reply_seen_at: string | null
  created_at: string
}

const KIND: Record<Mine['kind'], string> = { idea: 'پیشنهاد', problem: 'مشکل', question: 'سؤال', other: 'پیام' }
const STATUS: Record<Mine['status'], { label: string; cls: string }> = {
  new: { label: 'رسید', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'در حال بررسی', cls: 'bg-sky-50 text-sky-800' },
  answered: { label: 'جواب داده شد', cls: 'bg-emerald-50 text-emerald-800' },
  closed: { label: 'بسته شد', cls: 'bg-slate-100 text-slate-600' },
}
const date = (iso: string) => new Date(iso).toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function ParentFeedbackPage() {
  const [items, setItems] = useState<Mine[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<{ items: Mine[]; unread: number }>('/api/feedback/mine').then(r => {
      if (r.error || !r.data) { setError(r.error ?? 'پیام‌ها بارگذاری نشد'); return }
      setError(null)
      setItems(r.data.items)
      // Seen on display: the highlight stays for this visit, the badge clears.
      if (r.data.unread > 0) api.post('/api/feedback/mine/seen', {})
    })
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className={`min-h-screen bg-parent-bg pb-16 ${containerWidths.app}`}>
      <PageHeader title="پیشنهاد، مشکل یا سؤال" subtitle="مستقیم برای تیم کودک‌بوک بنویسید"
        back="/parent/dashboard" backLabel="برگشت به داشبورد" />
      <div className="p-4 space-y-5">
        <Panel>
          <FeedbackForm mode="parent" screen="parent/feedback" onSent={load} />
        </Panel>

        <Panel title="پیام‌های من" labelledById="my-feedback-title">
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {!items && !error && <p className="text-sm text-parent-muted">در حال بارگذاری…</p>}
          {items && items.length === 0 && <p className="text-sm text-parent-muted">هنوز پیامی نفرستاده‌اید.</p>}
          {items && items.length > 0 && (
            <ul className="space-y-3">
              {items.map(i => {
                const fresh = !!i.reply && !i.reply_seen_at
                return (
                  <li key={i.id} className={`rounded-2xl border p-4 ${fresh ? 'border-amber-300 bg-amber-50/50' : 'border-border bg-white'}`}>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-parent-text">{KIND[i.kind]}</span>
                      <span className="text-parent-muted">{date(i.created_at)}</span>
                      <span className={`ms-auto rounded-full px-2.5 py-0.5 font-bold ${STATUS[i.status].cls}`}>{STATUS[i.status].label}</span>
                    </div>
                    <p className="text-sm text-parent-text mt-2 whitespace-pre-wrap leading-7">{i.message}</p>
                    {i.reply && (
                      <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                        <p className="text-xs font-bold text-emerald-900">
                          جواب تیم کودک‌بوک{i.replied_at ? `، ${date(i.replied_at)}` : ''}{fresh ? '، تازه' : ''}
                        </p>
                        <p className="text-sm text-emerald-950 mt-1 whitespace-pre-wrap leading-7">{i.reply}</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
