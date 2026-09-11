'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { containerWidths } from '@/components/shared/layout'
import { Panel } from '@/components/parent/flat'
import { Icon } from '@/components/icons'
import { faDuration } from '@/lib/readAloud'
import { fa } from '@/lib/parentHeadline'
import type { Child, ReadAloudRecording } from '@koodakbook/shared'

/* ── The other half of the read-aloud loop ───────────────────────────────────
 *
 * The child records; this is where a parent hears it. Flat register, because
 * the parent is scanning, but this page is an exception to the "calm and
 * dense" rule in one respect: the newest unheard recording is the reason the
 * parent opened the page, so it is marked, not merely first.
 *
 * The audio is NOT an <audio src> pointing at the API. That endpoint requires
 * an Authorization header, which the browser will not attach to a media
 * element — and that is deliberate, since the alternative is a URL that plays
 * a child's voice for anyone holding it. Each clip is fetched as a blob with
 * the token and played from an object URL that is revoked on unmount.
 */

export default function RecordingsPage() {
  const [child, setChild] = useState<Child | null>(null)
  const [items, setItems] = useState<ReadAloudRecording[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (childId: string) => {
    const r = await api.get<ReadAloudRecording[]>(`/api/read-aloud/child/${childId}`)
    setItems(r.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    api.get<Child[]>('/api/children').then(r => {
      const c = pickChild(r.data ?? [])
      if (!c) { setLoading(false); return }
      setChild(c)
      load(c.id)
    })
  }, [load])

  async function setKept(id: string, kept: boolean) {
    setItems(xs => xs.map(x => (x.id === id ? { ...x, kept } : x)))
    await api.patch(`/api/read-aloud/${id}`, { kept })
    if (child) load(child.id)
  }

  async function remove(id: string) {
    setItems(xs => xs.filter(x => x.id !== id))
    await api.delete(`/api/read-aloud/${id}`)
  }

  function markHeard(id: string) {
    setItems(xs => xs.map(x => (x.id === id ? { ...x, heard_at: new Date().toISOString() } : x)))
    api.post(`/api/read-aloud/${id}/heard`, {})
  }

  return (
    <div className={`min-h-screen bg-parent-bg ${containerWidths.app}`}>
      <div className="bg-parent-surface border-b border-border px-5 py-4 flex items-center gap-3">
        <Link href="/parent/settings" aria-label="برگشت"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-parent-muted hover:text-parent-text hover:bg-surface-subtle transition-colors">
          <Icon name="back" size="md" />
        </Link>
        <div>
          <h1 className="font-bold text-xl text-parent-text">صداهای ضبط‌شده</h1>
          <p className="text-sm text-parent-muted">
            {child ? `${child.name} داستان‌ها را خوانده است` : 'کتاب‌خواندن با صدای کودک'}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading && <p className="text-sm text-parent-muted px-1">در حال بارگذاری…</p>}

        {!loading && items.length === 0 && (
          <Panel>
            <p className="text-sm text-parent-text font-medium">هنوز صدایی ضبط نشده است.</p>
            <p className="text-sm text-parent-muted mt-1.5 leading-relaxed">
              بعد از تمام‌شدن هر داستان، از کودک پرسیده می‌شود که آن را با صدای خودش بخواند.
            </p>
          </Panel>
        )}

        {items.map(rec => (
          <RecordingRow key={rec.id} rec={rec}
            onHeard={() => markHeard(rec.id)}
            onKeep={() => setKept(rec.id, !rec.kept)}
            onDelete={() => remove(rec.id)} />
        ))}

        {items.length > 0 && (
          /* The retention rule restated where its consequence is visible,
             rather than only at the consent toggle the parent read once. */
          <p className="text-xs text-parent-muted px-1 leading-relaxed">
            صداها بعد از ۳۰ روز خودکار پاک می‌شوند. برای نگه‌داشتن یک صدا، «نگه دار» را بزنید.
          </p>
        )}
      </div>
    </div>
  )
}

function RecordingRow({ rec, onHeard, onKeep, onDelete }: {
  rec: ReadAloudRecording
  onHeard: () => void
  onKeep: () => void
  onDelete: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  async function play() {
    if (playing) { audioRef.current?.pause(); return }
    let src = url
    if (!src) {
      setBusy(true)
      const token = getToken()
      try {
        const res = await fetch(`/api/read-aloud/${rec.id}/audio`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error('fetch failed')
        src = URL.createObjectURL(await res.blob())
        setUrl(src)
      } catch {
        setBusy(false); setFailed(true); return
      }
      setBusy(false)
    }
    const el = audioRef.current
    if (!el) return
    el.src = src
    try { await el.play(); setPlaying(true); onHeard() } catch { setFailed(true) }
  }

  const unheard = !rec.heard_at
  const date = new Date(rec.created_at).toLocaleDateString('fa-IR',
    { month: 'long', day: 'numeric' })

  return (
    <Panel>
      <div className="flex items-center gap-3">
        <audio ref={audioRef} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
        <button
          onClick={play} disabled={busy}
          aria-label={playing ? 'توقف' : `پخش ضبط ${rec.story_title ?? ''}`.trim()}
          className="w-12 h-12 rounded-full grid place-items-center text-white shrink-0 disabled:opacity-50"
          style={{ background: 'var(--ramp-brand-bright)' }}
        >
          <Icon name={busy ? 'loop' : playing ? 'pause' : 'play'} size="md" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-parent-text text-sm truncate">
              {rec.story_title ?? 'داستان'}
            </p>
            {/* State encoded as a chip as well as position — a parent scanning
                a list should see what is new without reading dates. */}
            {unheard && (
              <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }}>
                تازه
              </span>
            )}
            {rec.kept && (
              <span className="shrink-0 text-parent-muted" title="نگه‌داشته شده">
                <Icon name="protect" size="sm" />
              </span>
            )}
          </div>
          <p className="text-xs text-parent-muted mt-0.5 tabular-nums">
            {date} · {rec.duration_ms ? faDuration(rec.duration_ms) : `${fa(Math.round(rec.bytes / 1024))} کیلوبایت`}
          </p>
          {failed && <p className="text-xs text-rose-700 mt-1">پخش نشد. دوباره تلاش کنید.</p>}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onKeep}
            aria-pressed={rec.kept}
            aria-label={rec.kept ? 'دیگر نگه ندار' : 'نگه دار'}
            className="min-w-[40px] min-h-[40px] grid place-items-center rounded-lg text-parent-muted hover:bg-surface-subtle transition-colors">
            <Icon name={rec.kept ? 'protect' : 'save'} size="sm" />
          </button>
          <button onClick={() => setConfirmDelete(true)}
            aria-label="حذف"
            className="min-w-[40px] min-h-[40px] grid place-items-center rounded-lg text-parent-muted hover:bg-surface-subtle hover:text-rose-600 transition-colors">
            <Icon name="delete" size="sm" />
          </button>
        </div>
      </div>

      {/* Deleting a recording of a child's voice is irreversible and the
          button sits next to «نگه دار», so it asks first. */}
      {confirmDelete && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
          <p className="text-sm text-parent-text">این صدا برای همیشه پاک شود؟</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={onDelete}
              className="min-h-[40px] px-3 rounded-lg bg-rose-600 text-white text-sm font-bold">
              پاک کن
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="min-h-[40px] px-3 rounded-lg bg-surface-subtle text-parent-text text-sm font-bold">
              بی‌خیال
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}
