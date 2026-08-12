'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { PageHeader, Badge, Spinner, Button, EmptyState, Card } from '@/components/ui'

/* Word-image review queue.
 *
 * Candidate art is generated offline in batches (tools/word-images, local
 * ComfyUI/SDXL) and uploaded to image_candidate_url. Nothing here is visible
 * to a child until someone clicks تأیید — approve is the only path that writes
 * words.image_url.
 *
 * Built for clearing 20-30 in a sitting: the whole batch is on screen at once,
 * approve is a single click with no confirmation step, and each card resolves
 * in place so the reviewer never loses their scroll position. Reject opens an
 * inline reason box because a rejection with no reason tells the next
 * generation pass nothing. */

type Status = 'pending' | 'approved' | 'rejected'

interface QueueWord {
  id: string
  persian: string
  english: string
  category: string
  image_url: string | null
  image_candidate_url: string | null
  animation_review: Status
  image_review_note: string | null
}
interface Counts { pending: string; approved: string; rejected: string; no_image: string }

const TABS: { key: Status; label: string }[] = [
  { key: 'pending', label: 'در انتظار بررسی' },
  { key: 'approved', label: 'تأیید شده' },
  { key: 'rejected', label: 'رد شده' },
]

export default function WordImagesPage() {
  const [status, setStatus] = useState<Status>('pending')
  const [words, setWords] = useState<QueueWord[]>([])
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [rejecting, setRejecting] = useState<Record<string, string>>({})

  const load = useCallback(async (s: Status) => {
    setLoading(true); setError('')
    const res = await api.get<{ words: QueueWord[]; counts: Counts }>(`/api/admin/word-images/queue?status=${s}`)
    if (res.error) setError(res.error)
    else { setWords(res.data?.words ?? []); setCounts(res.data?.counts ?? null) }
    setLoading(false)
  }, [])

  useEffect(() => { void load(status) }, [status, load])

  async function decide(id: string, decision: 'approved' | 'rejected', note?: string) {
    setBusy(b => ({ ...b, [id]: true }))
    const res = await api.post<QueueWord>(`/api/admin/word-images/${id}/review`, { decision, note })
    setBusy(b => ({ ...b, [id]: false }))
    if (res.error) { setError(res.error); return }
    // Resolve in place — the card leaves the current tab, the rest stay put.
    setWords(ws => ws.filter(w => w.id !== id))
    setRejecting(r => { const { [id]: _drop, ...rest } = r; return rest })
    setCounts(c => c && {
      ...c,
      pending: String(Math.max(0, Number(c.pending) - 1)),
      [decision]: String(Number(c[decision]) + 1),
    } as Counts)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="تصویر کلمات"
        subtitle="تصویرهای ساخته‌شده پیش از نمایش به کودک باید تأیید شوند. تأیید تنها راهی است که تصویر را منتشر می‌کند."
        actions={<Button variant="secondary" onClick={() => void load(status)}>تازه‌سازی</Button>}
      />

      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-2xl font-bold text-amber-600">{counts.pending}</div><div className="text-sm text-slate-500">در انتظار بررسی</div></Card>
          <Card className="p-4"><div className="text-2xl font-bold text-emerald-600">{counts.approved}</div><div className="text-sm text-slate-500">تأیید شده</div></Card>
          <Card className="p-4"><div className="text-2xl font-bold text-rose-600">{counts.rejected}</div><div className="text-sm text-slate-500">رد شده</div></Card>
          <Card className="p-4"><div className="text-2xl font-bold text-slate-700">{counts.no_image}</div><div className="text-sm text-slate-500">هنوز بدون تصویر</div></Card>
        </div>
      )}

      <div className="flex gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              status === t.key ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {loading ? <Spinner /> : words.length === 0 ? (
        <EmptyState>
          {status === 'pending'
            ? 'هیچ تصویری در انتظار بررسی نیست.'
            : 'موردی در این بخش نیست.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {words.map(w => (
            <Card key={w.id} className="p-3 flex flex-col gap-3">
              {/* The candidate is what the reviewer is judging — never image_url. */}
              {w.image_candidate_url && (
                <img
                  src={w.image_candidate_url}
                  alt={w.english}
                  className="w-full aspect-square object-cover rounded-lg bg-slate-100"
                />
              )}

              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-slate-800" dir="rtl">{w.persian}</div>
                  <div className="text-sm text-slate-500">{w.english}</div>
                </div>
                <Badge tone="gray">{w.category}</Badge>
              </div>

              {w.image_url && status === 'pending' && (
                <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                  این کلمه از قبل تصویر منتشرشده دارد؛ تأیید آن را جایگزین می‌کند.
                </div>
              )}
              {w.image_review_note && (
                <div className="text-xs text-rose-700 bg-rose-50 rounded p-2">دلیل رد: {w.image_review_note}</div>
              )}

              {status === 'pending' && (
                rejecting[w.id] !== undefined ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={rejecting[w.id]}
                      onChange={e => setRejecting(r => ({ ...r, [w.id]: e.target.value }))}
                      placeholder="چرا این تصویر مناسب نیست؟"
                      rows={2}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        className="flex-1"
                        disabled={!rejecting[w.id]?.trim() || busy[w.id]}
                        onClick={() => void decide(w.id, 'rejected', rejecting[w.id].trim())}
                      >ثبت رد</Button>
                      <Button
                        variant="secondary"
                        onClick={() => setRejecting(r => { const { [w.id]: _drop, ...rest } = r; return rest })}
                      >انصراف</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={busy[w.id]}
                      onClick={() => void decide(w.id, 'approved')}
                    >تأیید</Button>
                    <Button
                      variant="secondary"
                      disabled={busy[w.id]}
                      onClick={() => setRejecting(r => ({ ...r, [w.id]: '' }))}
                    >رد</Button>
                  </div>
                )
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
