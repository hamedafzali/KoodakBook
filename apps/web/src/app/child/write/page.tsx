'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import LoadingScreen from '@/components/child/LoadingScreen'
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
      <PageHeader title="تمرین نوشتن ✏️" subtitle={`حرف ${idx + 1} از ${letters.length}`} gradientClass="from-blue-400 to-cyan-500" />

      <div className="px-4 pt-5 flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { playTap(); speakOrPlay(letter.audio_url, letter.name_persian) }}
            className="bg-white rounded-2xl shadow-sm px-5 py-2 flex items-center gap-2 min-h-[44px]"
            aria-label={`بشنو: ${letter.name_persian}`}
          >
            <span className="text-2xl font-bold text-gray-800">{letter.character}</span>
            <span className="text-gray-500">{letter.name_persian}</span>
            <span className="text-amber-500 text-lg">🔊</span>
          </button>
        </div>

        <TracingCanvas key={letter.id} letter={letter.character} />

        <div className="flex gap-3 w-full max-w-sm">
          <motion.button
            onClick={() => { playTap(); setIdx(i => Math.max(0, i - 1)) }}
            disabled={idx === 0}
            whileTap={{ scale: 0.94 }}
            className="flex-1 py-4 rounded-md border-2 border-gray-200 text-gray-500 font-bold disabled:opacity-30 min-h-[56px]"
          >
            قبلی
          </motion.button>
          <motion.button
            onClick={() => { playSuccess(); setIdx(i => Math.min(letters.length - 1, i + 1)) }}
            disabled={idx === letters.length - 1}
            whileTap={{ scale: 0.94 }}
            className="flex-[2] py-4 rounded-md bg-gradient-to-r from-blue-400 to-cyan-500 text-white font-bold text-lg shadow-md disabled:opacity-40 min-h-[56px]"
          >
            بعدی ←
          </motion.button>
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
        className="bg-white rounded-lg shadow-md touch-none"
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
        className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
          hasDrawn ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
        }`}
      >
        🧹 پاک کن
      </motion.button>
    </div>
  )
}
