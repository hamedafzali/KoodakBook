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

/* رقم‌های فارسی (ages 6–7) — the one thing no school abroad teaches: reading
 * ۴۵۶ as 456. Both directions: see 7 → pick ۷, and see ۷ → pick 7. Age 6 →
 * single digits; 7+ → two-digit numbers. Every answer is spoken in Persian. */

const ROUNDS = 8

interface Q { value: number; dir: 'toPersian' | 'toWestern'; options: number[] }

export default function DigitsPage() {
  const router = useRouter()
  const [max, setMax] = useState<number | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    api.get<Child[]>('/api/children').then(r => {
      const age = childAge(pickChild(r.data ?? []))
      setMax(age <= 6 ? 9 : 99)   // 6 → single digits; older → two-digit
    })
  }, [router])

  if (max === null) return null
  return <Game key={run} max={max} onReplay={() => setRun(x => x + 1)} onHome={() => router.push('/child/math')} />
}

function Game({ max, onReplay, onHome }: { max: number; onReplay: () => void; onHome: () => void }) {
  const questions = useMemo<Q[]>(() =>
    Array.from({ length: ROUNDS }, (_, i) => {
      const value = Math.floor(Math.random() * (max + 1))
      return {
        value,
        dir: i % 2 === 0 ? 'toPersian' : 'toWestern',
        options: shufflePM([value, ...distractors(value, 2, max)]),
      }
    }), [max])

  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [stars, setStars] = useState(0)
  const q = questions[idx]
  const done = idx >= ROUNDS

  useEffect(() => {
    if (done) { playComplete(); confetti({ particleCount: 110, spread: 85, origin: { y: 0.45 }, colors: ['#38bdf8', '#fbbf24', '#a78bfa'] }) }
  }, [done])

  useEffect(() => {
    if (!done && q) speakPersian(numberToPersianWord(q.value))   // hear the number, find it
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(n: number) {
    if (picked !== null) return
    playTap()
    setPicked(n)
    const ok = n === q.value
    if (ok) { playSuccess(); setStars(s => s + 1) }
    speakPersian(ok ? `آفرین! ${numberToPersianWord(q.value)}` : `${numberToPersianWord(q.value)} این بود!`)
    setTimeout(() => { setPicked(null); setIdx(i => i + 1) }, 1200)
  }

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
        <Mascot size={130} mood="excited" />
      </motion.div>
      <h1 className="text-3xl font-bold text-gray-800">رقم‌شناس شدی! 🔢</h1>
      <p className="text-gray-600 persian-text">{toPersianDigits(stars)} ستاره از {toPersianDigits(ROUNDS)} تا</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <motion.button onClick={onReplay} whileTap={{ scale: 0.96 }}
          className="w-full py-4 rounded-md bg-brand-gradient text-white font-bold text-lg shadow-md">دوباره 🔁</motion.button>
        <motion.button onClick={onHome} whileTap={{ scale: 0.96 }}
          className="w-full py-3.5 rounded-md border-2 border-slate-200 text-slate-600 font-bold">دنیای اعداد 🏠</motion.button>
      </div>
    </div>
  )

  const prompt = q.dir === 'toPersian' ? String(q.value) : toPersianDigits(q.value)
  const optionLabel = (n: number) => q.dir === 'toPersian' ? toPersianDigits(n) : String(n)

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="رقم‌های فارسی ۱۲۳" subtitle="۷ همان 7 است!" gradientClass="from-sky-500 to-blue-500" />

      <div className="px-4 pt-5 max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 persian-text">سؤال {toPersianDigits(idx + 1)} از {toPersianDigits(ROUNDS)}</span>
          <span className="text-amber-500">{'⭐'.repeat(stars)}</span>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-7 text-center">
          <p className="text-gray-500 persian-text text-sm mb-3">
            {q.dir === 'toPersian' ? 'این عدد به رقمِ فارسی کدام است؟' : 'این عدد به رقمِ انگلیسی کدام است؟'}
          </p>
          <motion.p key={idx} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            className="text-7xl font-bold text-sky-600" dir="ltr">{prompt}</motion.p>
          <p className="text-sm text-gray-400 mt-2 persian-text">{numberToPersianWord(q.value)}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {q.options.map(n => {
            const show = picked !== null
            const cls = show
              ? n === q.value ? 'bg-green-100 border-green-400 text-green-700'
                : n === picked ? 'bg-red-100 border-red-300 text-red-500' : 'bg-white border-gray-100 text-gray-400'
              : 'bg-white border-gray-100 text-gray-800'
            return (
              <motion.button key={n} onClick={() => pick(n)} whileTap={{ scale: 0.94 }}
                className={`rounded-md border-2 py-6 shadow-sm font-bold text-4xl touch-target ${cls}`} dir="ltr"
                aria-label={numberToPersianWord(n)}>
                {optionLabel(n)}
              </motion.button>
            )
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
