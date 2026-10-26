'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import BottomNav from '@/components/child/BottomNav'
import PageHeader from '@/components/child/PageHeader'
import LoadingScreen from '@/components/child/LoadingScreen'
import EmptyState from '@/components/child/EmptyState'
import ErrorState from '@/components/child/ErrorState'
import { softClayVars, clayVars } from '@/components/child/clay'
import { Icon } from '@/components/icons'
import { toPersianDigits } from '@koodakbook/shared'

/* «ویدیوها» — short videos for children (word songs, …), grouped into the
 * categories the admin manages (backend routes/videos.ts). Free for every
 * child. A tap opens the player on top of the list; ‹ › step through the
 * videos of the chosen category. */

interface VideoCategory { id: string; slug: string; title_fa: string; emoji: string | null }
interface Video {
  id: string; category_id: string; title_fa: string; description_fa: string | null
  video_url: string; cover_url: string | null; duration_sec: number | null
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1 } }

function duration(sec: number | null): string {
  if (!sec) return ''
  const s = Math.round(sec)
  return `${toPersianDigits(Math.floor(s / 60))}:${toPersianDigits(String(s % 60).padStart(2, '0'))}`
}

function Thumb({ v }: { v: Video }) {
  return (
    <div className="relative w-full aspect-video bg-videos-soft overflow-hidden">
      {v.cover_url
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded cover, any size
        ? <img src={v.cover_url} alt="" loading="lazy" className="w-full h-full object-cover" />
        // No cover: the browser draws the frame at 0.5 s as the picture.
        : <video src={`${v.video_url}#t=0.5`} preload="metadata" muted playsInline tabIndex={-1}
            className="w-full h-full object-cover pointer-events-none" aria-hidden="true" />}
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="w-14 h-14 rounded-full flex items-center justify-center shadow-raised bg-videos-bright text-videos-ink">
          <Icon name="play" size={28} />
        </span>
      </span>
      {v.duration_sec ? (
        <span className="absolute bottom-1.5 start-1.5 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded-md ltr" aria-hidden="true">
          {duration(v.duration_sec)}
        </span>
      ) : null}
    </div>
  )
}

export default function VideosPage() {
  const router = useRouter()
  const [cats, setCats] = useState<VideoCategory[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [cat, setCat] = useState<string>('all')
  const [playing, setPlaying] = useState<number | null>(null)   // index into `shown`

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    let cancelled = false
    api.get<{ categories: VideoCategory[]; videos: Video[] }>('/api/videos').then(r => {
      if (cancelled) return
      if (!r.data) { setLoadError(r.error ?? 'اتصال برقرار نشد. دوباره تلاش کن'); setLoading(false); return }
      setCats(r.data.categories); setVideos(r.data.videos); setLoading(false)
    })
    return () => { cancelled = true }
  }, [router, attempt])

  // "All" keeps the admin's category order, then each category's own order.
  const shown = useMemo(() => {
    if (cat !== 'all') return videos.filter(v => v.category_id === cat)
    const rank = new Map(cats.map((c, i) => [c.id, i]))
    return [...videos].sort((a, b) => (rank.get(a.category_id) ?? 99) - (rank.get(b.category_id) ?? 99))
  }, [videos, cats, cat])

  if (loading) return <LoadingScreen message="در حال آوردن ویدیوها..." />
  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => { setLoadError(null); setLoading(true); setAttempt(a => a + 1) }} />
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="ویدیوها" subtitle={videos.length ? `${toPersianDigits(videos.length)} ویدیو` : undefined} module="videos" />

      <div className="px-4 lg:px-8 pt-5">
        {cats.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1" role="tablist" aria-label="دسته‌های ویدیو">
            {[{ id: 'all', title_fa: 'همه', emoji: '🎬' }, ...cats].map(c => {
              const on = cat === c.id
              return (
                <button key={c.id} role="tab" aria-selected={on} onClick={() => setCat(c.id)}
                  className={`shrink-0 min-h-[48px] px-4 rounded-2xl font-bold text-body inline-flex items-center gap-1.5 ${on ? 'clay' : 'clay-static'}`}
                  style={on ? clayVars('videos') : softClayVars('videos')}>
                  {c.emoji && <span aria-hidden="true">{c.emoji}</span>} {c.title_fa}
                </button>
              )
            })}
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState message="هنوز ویدیویی نیست" subMessage="به زودی ویدیوهای تازه اضافه می‌شود!" />
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" key={cat}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" role="list" aria-label="لیست ویدیوها">
            {shown.map((v, i) => (
              <motion.div key={v.id} variants={item} role="listitem">
                <button onClick={() => setPlaying(i)} aria-label={`پخش ${v.title_fa}`}
                  className="clay-static block w-full overflow-hidden text-start" style={softClayVars('videos')}>
                  <Thumb v={v} />
                  <p className="p-3 font-bold text-text-primary text-body leading-tight persian-text">{v.title_fa}</p>
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {playing !== null && shown[playing] && (
        <Player list={shown} index={playing} onIndex={setPlaying} onClose={() => setPlaying(null)} />
      )}

      <BottomNav />
    </div>
  )
}

function Player({ list, index, onIndex, onClose }: {
  list: Video[]; index: number; onIndex: (i: number) => void; onClose: () => void
}) {
  const v = list[index]
  const ref = useRef<HTMLVideoElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [ended, setEnded] = useState(false)
  const hasPrev = index > 0
  const hasNext = index < list.length - 1

  const close = useCallback(() => { ref.current?.pause(); onClose() }, [onClose])
  useEffect(() => { setEnded(false) }, [index])
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [close])

  const navBtn = 'w-14 h-14 rounded-full clay inline-flex items-center justify-center disabled:opacity-30'

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 gap-4"
      role="dialog" aria-modal="true" aria-label={v.title_fa}>
      <div className="w-full max-w-4xl flex items-center gap-3">
        <h2 className="flex-1 text-white font-display font-black text-card-title persian-text truncate">{v.title_fa}</h2>
        <button ref={closeRef} onClick={close} aria-label="بستن" className={navBtn} style={clayVars('videos')}>
          <Icon name="close" size={26} />
        </button>
      </div>

      <div className="relative w-full max-w-4xl">
        <video key={v.id} ref={ref} src={v.video_url} poster={v.cover_url ?? undefined}
          controls autoPlay playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture
          onEnded={() => setEnded(true)} onPlay={() => setEnded(false)}
          className="w-full max-h-[70vh] rounded-3xl bg-black aspect-video" />
        {ended && (
          <div className="absolute inset-0 rounded-3xl bg-black/60 flex items-center justify-center gap-4">
            <button onClick={() => { const el = ref.current; if (el) { el.currentTime = 0; el.play() } }}
              className="clay min-h-[56px] px-5 rounded-2xl font-bold text-body inline-flex items-center gap-2" style={clayVars('videos')}>
              <Icon name="retry" size={22} /> دوباره
            </button>
            {hasNext && (
              <button onClick={() => onIndex(index + 1)}
                className="clay min-h-[56px] px-5 rounded-2xl font-bold text-body inline-flex items-center gap-2" style={clayVars('brand')}>
                بعدی <Icon name="forward" size={22} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* RTL: "previous" sits on the right and points right. */}
        <button onClick={() => onIndex(index - 1)} disabled={!hasPrev} aria-label="ویدیوی قبلی" className={navBtn} style={clayVars('videos')}>
          <Icon name="back" size={28} />
        </button>
        <span className="text-white/80 font-bold">{toPersianDigits(index + 1)} از {toPersianDigits(list.length)}</span>
        <button onClick={() => onIndex(index + 1)} disabled={!hasNext} aria-label="ویدیوی بعدی" className={navBtn} style={clayVars('videos')}>
          <Icon name="forward" size={28} />
        </button>
      </div>
    </div>
  )
}
