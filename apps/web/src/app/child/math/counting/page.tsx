'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { toPersianDigits, numberToPersianWord, childAge, shufflePM, distractors } from '@/lib/persianMath'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import Mascot from '@/components/child/Mascot'
import { playTap, playSuccess, playComplete } from '@/lib/sounds'
import { speakPersian, initSpeech } from '@/lib/speech'
import type { Child } from '@koodakbook/shared'

/* شمارش (ages 3–5) — tap-to-count. The child taps every fruit; each tap
 * speaks the next number («یک… دو…»). When all are counted they answer
 * «چند تا بود؟». Counting aloud WITH the tap is the lesson — one-to-one
 * correspondence in Persian. Under 5 → up to 5 items; at 5 → up to 10. */

const THINGS = ['🍎', '🐤', '🎈', '⭐', '🍓', '🐟', '🌸', '🚗']
const ROUNDS = 5

interface Round { emoji: string; count: number; options: number[] }

export default function CountingPage() {
  const router = useRouter()
  const [maxN, setMaxN] = useState<number | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    api.get<Child[]>('/api/children').then(r => {
      const age = childAge(pickChild(r.data ?? []))
      setMaxN(age <= 4 ? 5 : 10)   // band-appropriate ceiling
    })
  }, [router])

  if (maxN === null) return null
  return <Game key={run} maxN={maxN} onReplay={() => setRun(x => x + 1)} onHome={() => router.push('/child/math')} />
}

function Game({ maxN, onReplay, onHome }: { maxN: number; onReplay: () => void; onHome: () => void }) {
  const rounds = useMemo<Round[]>(() =>
    Array.from({ length: ROUNDS }, () => {
      const count = 1 + Math.floor(Math.random() * maxN)
      return {
        emoji: THINGS[Math.floor(Math.random() * THINGS.length)],
        count,
        options: shufflePM([count, ...distractors(count, 2, maxN + 2)]),
      }
    }), [maxN])

  const [idx, setIdx] = useState(0)
  const [tapped, setTapped] = useState<Set<number>>(new Set())
  const [picked, setPicked] = useState<number | null>(null)
  const [stars, setStars] = useState(0)
  const r = rounds[idx]
  const allCounted = tapped.size === r.count
  const done = idx >= ROUNDS

  useEffect(() => {
    if (done) { playComplete(); confetti({ particleCount: 110, spread: 85, origin: { y: 0.45 }, colors: ['#34d399', '#fbbf24', '#f472b6'] }) }
  }, [done])

  function tapItem(i: number) {
    if (tapped.has(i) || allCounted) return
    playTap()
    const next = new Set(tapped).add(i)
    setTapped(next)
    speakPersian(numberToPersianWord(next.size))   // the count IS the audio
    if (next.size === r.count) setTimeout(() => speakPersian(`چند تا بود؟`), 900)
  }

  function answer(n: number) {
    if (picked !== null || !allCounted) return
    setPicked(n)
    const ok = n === r.count
    if (ok) { playSuccess(); setStars(s => s + 1); speakPersian(`آفرین! ${numberToPersianWord(n)} تا!`) }
    else speakPersian(`${numberToPersianWord(r.count)} تا بود!`)
    setTimeout(() => { setPicked(null); setTapped(new Set()); setIdx(i => i + 1) }, 1400)
  }

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
        <Mascot size={130} mood="excited" />
      </motion.div>
      <h1 className="text-3xl font-bold text-gray-800">چه شمارشگری! 🌟</h1>
      <p className="text-gray-600 persian-text">{toPersianDigits(stars)} ستاره از {toPersianDigits(ROUNDS)} تا گرفتی</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <motion.button onClick={onReplay} whileTap={{ scale: 0.96 }}
          className="w-full py-4 rounded-md bg-brand-gradient text-white font-bold text-lg shadow-md">دوباره 🔁</motion.button>
        <motion.button onClick={onHome} whileTap={{ scale: 0.96 }}
          className="w-full py-3.5 rounded-md border-2 border-slate-200 text-slate-600 font-bold">دنیای اعداد 🏠</motion.button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="شمارش 🍎" subtitle="ضربه بزن و بشمار" gradientClass="from-emerald-500 to-green-500" />

      <div className="px-4 pt-5 max-w-md mx-auto space-y-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 persian-text">مرحله {toPersianDigits(idx + 1)} از {toPersianDigits(ROUNDS)}</span>
          <span className="text-amber-500">{'⭐'.repeat(stars)}</span>
        </div>

        {/* Tap stage — big targets for small fingers */}
        <div className="bg-white rounded-lg shadow-sm p-5 min-h-[220px]">
          <p className="text-center text-gray-600 persian-text text-sm mb-4">
            {allCounted ? 'حالا بگو: چند تا بود؟' : 'روی همه ضربه بزن و با من بشمار!'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {Array.from({ length: r.count }, (_, i) => (
              <motion.button key={i} onClick={() => tapItem(i)}
                whileTap={{ scale: 0.85 }}
                animate={tapped.has(i) ? { scale: [1, 1.35, 1.1], rotate: [0, 10, 0] } : {}}
                aria-label={tapped.has(i) ? `شمرده شد` : `بشمار`}
                className={`text-5xl w-16 h-16 rounded-2xl flex items-center justify-center touch-target transition ${
                  tapped.has(i) ? 'bg-emerald-100' : 'bg-emerald-50 hover:bg-emerald-100'}`}>
                {r.emoji}
              </motion.button>
            ))}
          </div>
          {tapped.size > 0 && (
            <motion.p key={tapped.size} initial={{ scale: 0.6 }} animate={{ scale: 1 }}
              className="text-center mt-4 text-4xl font-bold text-emerald-600">
              {toPersianDigits(tapped.size)}
              <span className="block text-base text-emerald-500 mt-1">{numberToPersianWord(tapped.size)}</span>
            </motion.p>
          )}
        </div>

        {/* Answer row appears once everything is counted */}
        <div className={`grid grid-cols-3 gap-3 transition-opacity ${allCounted ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          {r.options.map(n => {
            const show = picked !== null
            const cls = show
              ? n === r.count ? 'bg-green-100 border-green-400 text-green-700'
                : n === picked ? 'bg-red-100 border-red-300 text-red-500' : 'bg-white border-gray-100 text-gray-400'
              : 'bg-white border-gray-100 text-gray-800'
            return (
              <motion.button key={n} onClick={() => answer(n)} whileTap={{ scale: 0.94 }}
                className={`rounded-md border-2 py-5 shadow-sm font-bold touch-target ${cls}`}
                aria-label={numberToPersianWord(n)}>
                <span className="text-3xl block">{toPersianDigits(n)}</span>
                <span className="text-xs block mt-1 opacity-70 persian-text">{numberToPersianWord(n)}</span>
              </motion.button>
            )
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
