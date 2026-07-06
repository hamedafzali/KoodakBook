'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { toPersianDigits, numberToPersianWord, childAge, shufflePM, distractors, sayNumber, sayPhrase } from '@/lib/persianMath'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import Mascot from '@/components/child/Mascot'
import SceneBackdrop from '@/components/child/SceneBackdrop'
import { playTap, playSuccess, playComplete } from '@/lib/sounds'
import { speakPersian, initSpeech } from '@/lib/speech'
import type { Child } from '@koodakbook/shared'

/* بازار (ages 8–10) — cultural math: reading price tags in Persian digits and
 * paying in تومان. Age 8 → read a price; 9–10 → add two prices («روی هم چند
 * تومان می‌شود؟»). We never teach addition itself — school did that; we teach
 * saying it in Persian. */

const GOODS = [
  { emoji: '🍎', name: 'سیب' }, { emoji: '🍌', name: 'موز' }, { emoji: '🥕', name: 'هویج' },
  { emoji: '🍇', name: 'انگور' }, { emoji: '🍞', name: 'نان' }, { emoji: '🧀', name: 'پنیر' },
  { emoji: '🍉', name: 'هندوانه' }, { emoji: '🍪', name: 'شیرینی' },
]
const ROUNDS = 6

interface Stall { items: { emoji: string; name: string; price: number }[] }
interface Q { stall: Stall; mode: 'read' | 'sum'; targets: number[]; answer: number; options: number[] }

export default function BazaarPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'read' | 'sum' | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    api.get<Child[]>('/api/children').then(r => {
      const age = childAge(pickChild(r.data ?? []))
      setMode(age <= 8 ? 'read' : 'sum')   // 8 reads prices; 9–10 adds them
    })
  }, [router])

  if (!mode) return null
  return <Game key={run} mode={mode} onReplay={() => setRun(x => x + 1)} onHome={() => router.push('/child/math')} />
}

function makeQuestion(mode: 'read' | 'sum'): Q {
  const picked = shufflePM(GOODS).slice(0, 3)
  const items = picked.map(g => ({ ...g, price: (1 + Math.floor(Math.random() * 9)) * 10 }))  // 10–90 toman, round
  if (mode === 'read') {
    const t = Math.floor(Math.random() * items.length)
    const answer = items[t].price
    return { stall: { items }, mode, targets: [t], answer, options: shufflePM([answer, ...distractors(answer / 10, 2, 9).map(d => d * 10)]) }
  }
  const [a, b] = shufflePM([0, 1, 2]).slice(0, 2)
  const answer = items[a].price + items[b].price
  const wrong = distractors(answer / 10, 2, 19).map(d => d * 10)
  return { stall: { items }, mode, targets: [a, b], answer, options: shufflePM([answer, ...wrong]) }
}

function Game({ mode, onReplay, onHome }: { mode: 'read' | 'sum'; onReplay: () => void; onHome: () => void }) {
  const questions = useMemo<Q[]>(() => Array.from({ length: ROUNDS }, () => makeQuestion(mode)), [mode])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [stars, setStars] = useState(0)
  const q = questions[idx]
  const done = idx >= ROUNDS

  useEffect(() => {
    if (done) { playComplete(); confetti({ particleCount: 110, spread: 85, origin: { y: 0.45 }, colors: ['#fbbf24', '#fb923c', '#4ade80'] }) }
  }, [done])

  useEffect(() => {
    if (done || !q) return
    const names = q.targets.map(t => q.stall.items[t].name)
    speakPersian(q.mode === 'read' ? `${names[0]} چند تومان است؟` : `یک ${names[0]} و یک ${names[1]}، روی هم چند تومان می‌شود؟`)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(n: number) {
    if (picked !== null) return
    playTap()
    setPicked(n)
    const ok = n === q.answer
    if (ok) { playSuccess(); setStars(s => s + 1); sayPhrase('afarin', 'آفرین!') }
    else sayNumber(q.answer)
    setTimeout(() => { setPicked(null); setIdx(i => i + 1) }, 1500)
  }

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
        <Mascot size={130} mood="excited" />
      </motion.div>
      <h1 className="text-3xl font-bold text-gray-800">چه خریدار زرنگی! 🛒</h1>
      <p className="text-gray-600 persian-text">{toPersianDigits(stars)} ستاره از {toPersianDigits(ROUNDS)} خرید</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <motion.button onClick={onReplay} whileTap={{ scale: 0.96 }}
          className="w-full py-4 rounded-md bg-brand-gradient text-white font-bold text-lg shadow-md">دوباره 🔁</motion.button>
        <motion.button onClick={onHome} whileTap={{ scale: 0.96 }}
          className="w-full py-3.5 rounded-md border-2 border-slate-200 text-slate-600 font-bold">دنیای اعداد 🏠</motion.button>
      </div>
    </div>
  )

  const names = q.targets.map(t => q.stall.items[t].name)

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="بازار 🛒" subtitle="با تومان خرید کن" gradientClass="from-amber-500 to-orange-500" />

      <div className="px-4 pt-5 max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 persian-text">خرید {toPersianDigits(idx + 1)} از {toPersianDigits(ROUNDS)}</span>
          <span className="text-amber-500">{'⭐'.repeat(stars)}</span>
        </div>

        {/* The stall, set in the bazaar scene */}
        <div className="relative">
          <SceneBackdrop scene="bazaar" time="day" className="w-full h-40" />
          <div className="absolute inset-x-3 bottom-2 grid grid-cols-3 gap-2">
            {q.stall.items.map((it, i) => (
              <div key={i} className={`bg-white/95 rounded-2xl p-2 text-center shadow ${q.targets.includes(i) && picked === null ? 'ring-2 ring-amber-400' : ''}`}>
                <span className="text-3xl block" aria-hidden="true">{it.emoji}</span>
                <span className="text-[11px] text-gray-600 persian-text block">{it.name}</span>
                <span className="text-sm font-bold text-amber-700 block">{toPersianDigits(it.price)} تومان</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="persian-text text-gray-700 font-bold">
            {q.mode === 'read'
              ? <>{names[0]} چند تومان است؟</>
              : <>یک {names[0]} و یک {names[1]} — روی هم چند تومان می‌شود؟</>}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {q.options.map(n => {
            const show = picked !== null
            const cls = show
              ? n === q.answer ? 'bg-green-100 border-green-400 text-green-700'
                : n === picked ? 'bg-red-100 border-red-300 text-red-500' : 'bg-white border-gray-100 text-gray-400'
              : 'bg-white border-gray-100 text-gray-800'
            return (
              <motion.button key={n} onClick={() => pick(n)} whileTap={{ scale: 0.94 }}
                className={`rounded-md border-2 py-4 shadow-sm font-bold touch-target ${cls}`}
                aria-label={`${numberToPersianWord(n)} تومان`}>
                <span className="text-2xl block">{toPersianDigits(n)}</span>
                <span className="text-[10px] block opacity-70 persian-text">تومان</span>
              </motion.button>
            )
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
