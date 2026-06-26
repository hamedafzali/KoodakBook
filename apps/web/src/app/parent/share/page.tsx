'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import type { DashboardSummary, Child } from '@koodakbook/shared'
import { containerWidths } from '@/components/shared/layout'

/* Portrait card sized for WhatsApp / status sharing. */
const W = 1080
const H = 1350

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draw the shareable progress card onto a canvas (no external deps). */
async function drawCard(canvas: HTMLCanvasElement | null, s: DashboardSummary) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Persian glyphs must be shaped with Vazirmatn — make sure it's loaded first.
  try {
    await Promise.all([
      document.fonts.load('700 72px Vazirmatn'),
      document.fonts.load('500 40px Vazirmatn'),
    ])
    await document.fonts.ready
  } catch { /* fall back to system shaping */ }

  ctx.clearRect(0, 0, W, H)
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'

  // Background gradient (matches the child home hero)
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#fbbf24')
  bg.addColorStop(0.5, '#fb923c')
  bg.addColorStop(1, '#fb7185')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Inner white card
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 70, 90, W - 140, H - 180, 64)
  ctx.fill()

  const cx = W / 2

  // Mascot / celebration
  ctx.font = '180px sans-serif'
  ctx.fillText('🦚', cx, 320)

  // Headline
  ctx.fillStyle = '#1f2937'
  ctx.font = '700 64px Vazirmatn, sans-serif'
  ctx.fillText('🌟 آفرین 🌟', cx, 430)
  ctx.font = '700 56px Vazirmatn, sans-serif'
  ctx.fillStyle = '#ea580c'
  ctx.fillText(`«${s.child.name}»`, cx, 520)
  ctx.fillStyle = '#1f2937'
  ctx.font = '500 44px Vazirmatn, sans-serif'
  ctx.fillText('داره فارسی یاد می‌گیره!', cx, 590)

  // Stat pills
  const stats: [string, string, string][] = [
    ['⭐', String(s.words_learned), 'کلمه'],
    ['📖', String(s.stories_completed), 'داستان'],
    ['🔥', String(s.streak_days), 'روز'],
  ]
  const pillW = 270
  const gap = 24
  const totalW = stats.length * pillW + (stats.length - 1) * gap
  let px = cx - totalW / 2
  const py = 680
  for (const [emoji, num, label] of stats) {
    ctx.fillStyle = '#fff7ed'
    roundRect(ctx, px, py, pillW, 230, 40)
    ctx.fill()
    const m = px + pillW / 2
    ctx.font = '90px sans-serif'
    ctx.fillText(emoji, m, py + 100)
    ctx.fillStyle = '#ea580c'
    ctx.font = '700 64px Vazirmatn, sans-serif'
    ctx.fillText(num, m, py + 165)
    ctx.fillStyle = '#6b7280'
    ctx.font = '500 34px Vazirmatn, sans-serif'
    ctx.fillText(label, m, py + 210)
    px += pillW + gap
  }

  // Latest badge
  const badge = s.recent_badges?.[0]?.badge
  if (badge) {
    ctx.fillStyle = '#fef3c7'
    roundRect(ctx, 140, 960, W - 280, 110, 40)
    ctx.fill()
    ctx.fillStyle = '#92400e'
    ctx.font = '500 40px Vazirmatn, sans-serif'
    ctx.fillText(`🏆  ${badge.title}`, cx, 1028)
  }

  // Branding footer
  ctx.fillStyle = '#9ca3af'
  ctx.font = '500 36px Vazirmatn, sans-serif'
  ctx.fillText('کوداک‌بوک · KoodakBook', cx, H - 150)
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '500 30px Vazirmatn, sans-serif'
  ctx.fillText('یادگیری فارسی برای کودکان', cx, H - 100)
}

export default function SharePage() {
  const router = useRouter()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const childRes = await api.get<Child[]>('/api/children')
      const child = pickChild(childRes.data ?? [])
      if (child) {
        const dash = await api.get<DashboardSummary>(`/api/dashboard/${child.id}`)
        if (dash.data) setSummary(dash.data)
      }
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (summary) drawCard(canvasRef.current, summary)
  }, [summary])

  function shareText() {
    if (!summary) return ''
    return `«${summary.child.name}» در کوداک‌بوک داره فارسی یاد می‌گیره! 🌟 تا حالا ${summary.words_learned} کلمه یاد گرفته.`
  }

  function canvasBlob(): Promise<Blob | null> {
    return new Promise(resolve => {
      const c = canvasRef.current
      if (!c) return resolve(null)
      c.toBlob(b => resolve(b), 'image/png')
    })
  }

  async function handleShare() {
    const blob = await canvasBlob()
    const text = shareText()
    const url = typeof window !== 'undefined' ? window.location.origin : ''
    // Best path: native share sheet with the card image (mobile → WhatsApp etc.)
    if (blob && typeof navigator !== 'undefined' && navigator.canShare) {
      const file = new File([blob], 'koodakbook.png', { type: 'image/png' })
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: `${text} ${url}`.trim() })
          return
        } catch { /* user cancelled or unsupported — fall through */ }
      }
    }
    // Fallback: open WhatsApp with the message + link
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`, '_blank')
  }

  async function handleDownload() {
    const blob = await canvasBlob()
    if (!blob) return
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `koodakbook-${summary?.child.name ?? 'card'}.png`
    a.click()
    URL.revokeObjectURL(href)
    setNote('تصویر ذخیره شد ✅')
    setTimeout(() => setNote(''), 2500)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-gray-400 persian-text">در حال بارگذاری...</div>
    </div>
  )

  if (!summary) return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 bg-slate-50">
        <div className="text-6xl">👶</div>
        <p className="text-gray-600 font-medium text-center persian-text">هنوز پیشرفتی برای اشتراک‌گذاری نیست</p>
        <Link href="/parent/dashboard" className="text-amber-600 font-bold">برگشت به داشبورد</Link>
      </div>
  )

  return (
      <div className={`min-h-screen bg-slate-50 pb-20 ${containerWidths.app}`}>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center gap-3">
          <Link
            href="/parent/dashboard"
            aria-label="برگشت"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
          <div>
            <h1 className="font-bold text-xl text-slate-800">کارت پیشرفت</h1>
            <p className="text-sm text-slate-500 mt-0.5">برای پدربزرگ و مادربزرگ بفرست 💛</p>
          </div>
        </div>

        <div className="px-4 pt-6 flex flex-col items-center gap-5">
          {/* Card preview */}
          <motion.canvas
            ref={canvasRef}
            width={W}
            height={H}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xs rounded-lg shadow-lg"
            role="img"
            aria-label={`کارت پیشرفت ${summary.child.name}`}
          />

          <div className="w-full max-w-xs space-y-3">
            <motion.button
              onClick={handleShare}
              whileTap={{ scale: 0.96 }}
              className="w-full py-4 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md min-h-[56px] flex items-center justify-center gap-2"
            >
              📤 به اشتراک بگذار
            </motion.button>
            <motion.button
              onClick={handleDownload}
              whileTap={{ scale: 0.96 }}
              className="w-full py-3.5 rounded-md border-2 border-slate-200 text-slate-600 font-bold min-h-[52px]"
            >
              💾 ذخیره تصویر
            </motion.button>
            {note && <p className="text-center text-green-600 text-sm font-medium">{note}</p>}
          </div>
        </div>
      </div>
  )
}
