'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { PageHeader, Badge, Spinner, Button, EmptyState, Card } from '@/components/ui'

/* Story cover review queue — mirrors dashboard/word-images/page.tsx exactly,
 * applied to stories.cover_url instead of words.image_url (migration 053 /
 * adminStoryCovers.ts).
 *
 * Candidate art is generated offline (tools/story-covers, OpenAI Images API)
 * and uploaded to cover_candidate_url. Nothing here is visible on a story
 * card until someone clicks تأیید — approve is the only path that writes
 * stories.cover_url. */

type Status = 'pending' | 'approved' | 'rejected'

interface QueueStory {
  id: string
  title_persian: string
  title_english: string
  stage: number
  cover_url: string | null
  cover_candidate_url: string | null
  cover_review: Status
  cover_review_note: string | null
}
interface Counts { pending: string; approved: string; rejected: string; no_cover: string }

const TABS: { key: Status; label: string }[] = [
  { key: 'pending', label: 'در انتظار بررسی' },
  { key: 'approved', label: 'تأیید شده' },
  { key: 'rejected', label: 'رد شده' },
]

export default function StoryCoversPage() {
  const [status, setStatus] = useState<Status>('pending')
  const [stories, setStories] = useState<QueueStory[]>([])
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [rejecting, setRejecting] = useState<Record<string, string>>({})

  const load = useCallback(async (s: Status) => {
    setLoading(true); setError('')
    const res = await api.get<{ stories: QueueStory[]; counts: Counts }>(`/api/admin/story-covers/queue?status=${s}`)
    if (res.error) setError(res.error)
    else { setStories(res.data?.stories ?? []); setCounts(res.data?.counts ?? null) }
    setLoading(false)
  }, [])

  useEffect(() => { void load(status) }, [status, load])

  async function decide(id: string, decision: 'approved' | 'rejected', note?: string) {
    setBusy(b => ({ ...b, [id]: true }))
    const res = await api.post<QueueStory>(`/api/admin/story-covers/${id}/review`, { decision, note })
    setBusy(b => ({ ...b, [id]: false }))
    if (res.error) { setError(res.error); return }
    // Resolve in place — the card leaves the current tab, the rest stay put.
    setStories(ss => ss.filter(s => s.id !== id))
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
        title="تصویر جلد داستان‌ها"
        subtitle="تصویرهای جلد ساخته‌شده پیش از نمایش باید تأیید شوند. تأیید تنها راهی است که تصویر را منتشر می‌کند."
        actions={<Button variant="secondary" onClick={() => void load(status)}>تازه‌سازی</Button>}
      />

      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-2xl font-bold text-amber-600">{counts.pending}</div><div className="text-sm text-slate-500">در انتظار بررسی</div></Card>
          <Card className="p-4"><div className="text-2xl font-bold text-emerald-600">{counts.approved}</div><div className="text-sm text-slate-500">تأیید شده</div></Card>
          <Card className="p-4"><div className="text-2xl font-bold text-rose-600">{counts.rejected}</div><div className="text-sm text-slate-500">رد شده</div></Card>
          <Card className="p-4"><div className="text-2xl font-bold text-slate-700">{counts.no_cover}</div><div className="text-sm text-slate-500">هنوز بدون جلد</div></Card>
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

      {loading ? <Spinner /> : stories.length === 0 ? (
        <EmptyState>
          {status === 'pending'
            ? 'هیچ جلدی در انتظار بررسی نیست.'
            : 'موردی در این بخش نیست.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map(s => (
            <Card key={s.id} className="p-3 flex flex-col gap-3">
              {/* The candidate is what the reviewer is judging — never cover_url. */}
              {s.cover_candidate_url && (
                <img
                  src={s.cover_candidate_url}
                  alt={s.title_english}
                  className="w-full aspect-[3/2] object-cover rounded-lg bg-slate-100"
                />
              )}

              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-slate-800" dir="rtl">{s.title_persian}</div>
                  <div className="text-sm text-slate-500">{s.title_english}</div>
                </div>
                <Badge tone="gray">مرحله {s.stage}</Badge>
              </div>

              {s.cover_url && status === 'pending' && (
                <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                  این داستان از قبل جلد منتشرشده دارد؛ تأیید آن را جایگزین می‌کند.
                </div>
              )}
              {s.cover_review_note && (
                <div className="text-xs text-rose-700 bg-rose-50 rounded p-2">دلیل رد: {s.cover_review_note}</div>
              )}

              {status === 'pending' && (
                rejecting[s.id] !== undefined ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={rejecting[s.id]}
                      onChange={e => setRejecting(r => ({ ...r, [s.id]: e.target.value }))}
                      placeholder="چرا این تصویر مناسب نیست؟"
                      rows={2}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        className="flex-1"
                        disabled={!rejecting[s.id]?.trim() || busy[s.id]}
                        onClick={() => void decide(s.id, 'rejected', rejecting[s.id].trim())}
                      >ثبت رد</Button>
                      <Button
                        variant="secondary"
                        onClick={() => setRejecting(r => { const { [s.id]: _drop, ...rest } = r; return rest })}
                      >انصراف</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={busy[s.id]}
                      onClick={() => void decide(s.id, 'approved')}
                    >تأیید</Button>
                    <Button
                      variant="secondary"
                      disabled={busy[s.id]}
                      onClick={() => setRejecting(r => ({ ...r, [s.id]: '' }))}
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
