'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import LoadingScreen from '@/components/child/LoadingScreen'
import { ClayButton } from '@/components/child/clay'
import { playTap, playSuccess } from '@/lib/sounds'
import { speakOrPlay, initSpeech } from '@/lib/speech'
import type { Letter } from '@koodakbook/shared'

export default function WritePage() {
  const router = useRouter()
  const [letters, setLetters] = useState<Letter[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    api.get<Letter[]>('/api/letters').then(res => {
      if (res.data) setLetters(res.data)
      setLoading(false)
    })
  }, [router])

  const letter = letters[idx]

  // Say each letter the moment it appears — the child hears it before tracing;
  // the button stays for replay.
  useEffect(() => {
    if (!letter) return
    const t = setTimeout(() => speakOrPlay(letter.audio_url, letter.name_persian), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter?.id])

  if (loading) return <LoadingScreen message="در حال بارگذاری..." />
  if (letters.length === 0) return <LoadingScreen message="حرفی برای تمرین نیست" />

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="تمرین نوشتن" subtitle={`حرف ${idx + 1} از ${letters.length}`} module="write" />

      {/* pb-44: clears BOTH fixed bars below (the action bar + BottomNav),
          not just BottomNav's own .pb-nav reserve — see the action bar's
          comment for why it's fixed instead of sitting in normal flow. */}
      <div className="px-4 pt-5 pb-44 flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { playTap(); speakOrPlay(letter.audio_url, letter.name_persian) }}
            className="bg-white rounded-2xl shadow-card px-5 py-2 flex items-center gap-2 min-h-[56px]"
            aria-label={`بشنو: ${letter.name_persian}`}
          >
            <span className="text-2xl font-bold text-text-primary">{letter.character}</span>
            <span className="text-text-secondary">{letter.name_persian}</span>
            <span className="text-amber-500 text-lg" aria-hidden="true">🔊</span>
          </button>
        </div>

        <TracingCanvas key={letter.id} letter={letter.character} />
      </div>

      {/* Fixed action bar, not flow-positioned: on a short viewport (iPhone
          SE etc.) the header + audio chip + 300px canvas + clear button
          already reach the fold, so "بعدی" needs a scroll to find every
          single letter (2026-09 reachability audit). Pinned above BottomNav
          (bottom-20 = BottomNav's own .pb-nav reserve) it's always inside
          the one-thumb reach zone instead. Prev/Next also gained arrow
          glyphs — this screen exists because the child can't fully read
          yet, so the direction shouldn't be gated on reading "قبلی"/"بعدی". */}
      <div className="fixed inset-x-0 bottom-20 z-20 left-1/2 -translate-x-1/2 w-full max-w-[540px] px-4 pb-3">
        <div className="flex gap-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-raised p-3">
          <motion.button
            onClick={() => { playTap(); setIdx(i => Math.max(0, i - 1)) }}
            disabled={idx === 0}
            whileTap={{ scale: 0.94 }}
            className="flex-1 py-4 rounded-2xl border-2 border-border text-text-secondary font-bold disabled:opacity-30 min-h-[56px]"
          >
            → قبلی
          </motion.button>
          <ClayButton
            ramp="write" size="lg" className="flex-[2]"
            onClick={() => { playSuccess(); setIdx(i => Math.min(letters.length - 1, i + 1)) }}
            disabled={idx === letters.length - 1}
          >
            بعدی ←
          </ClayButton>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

/** A canvas the child draws on, with the target letter shown faintly as a guide. */
function TracingCanvas({ letter }: { letter: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    redrawGuide(ctx, canvas, letter)
  }, [letter])

  function redrawGuide(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, ch: string) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.fillStyle = '#e5e7eb' // faint guide
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${canvas.height * 0.6}px Vazirmatn, sans-serif`
    ctx.fillText(ch, canvas.width / 2, canvas.height / 2)
    ctx.restore()
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawing.current = true
    setHasDrawn(true)
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function end() { drawing.current = false }

  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    redrawGuide(ctx, canvas, letter)
    setHasDrawn(false)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="bg-white rounded-2xl shadow-card touch-none"
        style={{ width: 'min(80vw, 300px)', height: 'min(80vw, 300px)' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        role="img"
        aria-label={`بوم نقاشی برای نوشتن حرف ${letter}`}
      />
      <motion.button
        onClick={clear}
        whileTap={{ scale: 0.94 }}
        className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors min-h-[56px] ${
          hasDrawn ? 'bg-amber-100 text-amber-700' : 'bg-surface-subtle text-text-secondary'
        }`}
      >
        <span aria-hidden="true">🧹</span> پاک کن
      </motion.button>
    </div>
  )
}
