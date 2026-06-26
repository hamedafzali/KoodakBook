'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { isLoggedIn } from '@/lib/auth'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import Mascot from '@/components/child/Mascot'
import { playTap, playSuccess, playComplete } from '@/lib/sounds'
import { speakOrPlay, initSpeech } from '@/lib/speech'
import {
  SHORT_VOWELS, PHONICS_CONSONANTS, phonicsSyllables, phonicsAudioUrl,
  type Syllable,
} from '@koodakbook/shared'

const DEMO = 'ب' // base consonant used to demonstrate each vowel mark

function playErrorSound() {
  if (typeof window === 'undefined') return
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const osc = ctx.createOscillator(); const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.frequency.value = 280; osc.type = 'sine'
  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
  osc.start(); osc.stop(ctx.currentTime + 0.25)
}

function shuffle<T>(a: T[]): T[] { return [...a].sort(() => Math.random() - 0.5) }

export default function PhonicsPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'learn' | 'quiz' | 'done'>('learn')
  const all = useMemo(() => phonicsSyllables(), [])

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
  }, [router])

  function say(text: string, slug: string) {
    playTap()
    speakOrPlay(phonicsAudioUrl(slug), text)
  }

  if (phase === 'quiz') return <PhonicsQuiz all={all} say={say} onDone={() => setPhase('done')} onExit={() => setPhase('learn')} />

  if (phase === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
          <Mascot size={130} mood="excited" />
        </motion.div>
        <h1 className="text-3xl font-bold text-gray-800">آفرین! 🌟</h1>
        <p className="text-gray-600 persian-text">حالا می‌تونی حرف‌ها رو بخونی!</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <motion.button onClick={() => setPhase('quiz')} whileTap={{ scale: 0.96 }}
            className="w-full py-4 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md">
            یک بار دیگه 🔁
          </motion.button>
          <motion.button onClick={() => router.push('/child/home')} whileTap={{ scale: 0.96 }}
            className="w-full py-3.5 rounded-md border-2 border-slate-200 text-slate-600 font-bold">
            برگشت به خانه 🏠
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="صداها 🎵" subtitle="زبر، زیر، پیش" gradientClass="from-orange-500 to-amber-500" />

      <div className="px-4 pt-5 space-y-7">
        <div className="bg-white rounded-lg p-4 shadow-sm flex items-center gap-3">
          <Mascot size={64} mood="happy" />
          <p className="text-gray-700 persian-text text-sm flex-1">
            این سه نشانه به حرف‌ها صدا می‌دهند. ضربه بزن و گوش کن!
          </p>
        </div>

        {/* The three marks */}
        <section>
          <h2 className="font-bold text-gray-800 text-base mb-3">حرکت‌ها</h2>
          <div className="grid grid-cols-3 gap-3">
            {SHORT_VOWELS.map(v => {
              const syll = DEMO + v.mark
              return (
                <motion.button key={v.key} onClick={() => say(syll, 'b' + v.latin)} whileTap={{ scale: 0.95 }}
                  className={`bg-gradient-to-br ${v.color} rounded-[1.5rem] p-4 text-white shadow-md flex flex-col items-center gap-1 min-h-[110px] justify-center touch-target`}
                  aria-label={`${v.namePersian}: ${syll}`}>
                  <span className="text-5xl font-bold leading-none">{syll}</span>
                  <span className="text-sm font-medium mt-1">{v.namePersian}</span>
                  <span className="text-xs opacity-80 ltr">{v.latin}</span>
                </motion.button>
              )
            })}
          </div>
        </section>

        {/* Syllable grids per vowel */}
        {SHORT_VOWELS.map(v => (
          <section key={v.key}>
            <h2 className="font-bold text-gray-800 text-base mb-3">
              با {v.namePersian} <span className="text-gray-400 text-sm ltr">({v.latin})</span>
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {PHONICS_CONSONANTS.map(c => {
                const text = c.ch + v.mark
                const slug = c.latin + v.latin
                return (
                  <motion.button key={slug} onClick={() => say(text, slug)} whileTap={{ scale: 0.92 }}
                    className="bg-white rounded-2xl py-3 shadow-sm flex flex-col items-center gap-0.5 touch-target"
                    aria-label={`بخوان: ${text}`}>
                    <span className="text-3xl font-bold text-gray-800">{text}</span>
                    <span className="text-[11px] text-gray-400 ltr">{slug}</span>
                  </motion.button>
                )
              })}
            </div>
          </section>
        ))}

        <motion.button onClick={() => setPhase('quiz')} whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md min-h-[56px]">
          بریم تمرین 🎧
        </motion.button>
      </div>

      <BottomNav />
    </div>
  )
}

/* ── Listen-and-pick practice ──────────────────────────────────────────── */
function PhonicsQuiz({ all, say, onDone, onExit }: {
  all: Syllable[]
  say: (text: string, slug: string) => void
  onDone: () => void
  onExit: () => void
}) {
  const ROUNDS = 6
  const questions = useMemo(() => {
    return shuffle(all).slice(0, ROUNDS).map(correct => {
      const distractors = shuffle(all.filter(s => s.slug !== correct.slug)).slice(0, 3)
      return { correct, options: shuffle([correct, ...distractors]) }
    })
  }, [all])

  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const firedRef = useRef(false)
  const q = questions[idx]

  // auto-play the target when the question appears
  useEffect(() => {
    if (q) { const t = setTimeout(() => say(q.correct.text, q.correct.slug), 350); return () => clearTimeout(t) }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  function choose(slug: string) {
    if (picked) return
    setPicked(slug)
    const ok = slug === q.correct.slug
    if (ok) { playSuccess(); setCorrectCount(c => c + 1) } else { playErrorSound() }
    setTimeout(() => {
      if (idx >= questions.length - 1) {
        if (!firedRef.current) {
          firedRef.current = true
          confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 }, colors: ['#f97316', '#22c55e', '#3b82f6'] })
          playComplete()
        }
        onDone()
      } else { setPicked(null); setIdx(i => i + 1) }
    }, 900)
  }

  return (
    <div className="min-h-screen child-bg flex flex-col">
      <div className="bg-white/85 backdrop-blur-md border-b border-amber-100 px-5 py-3 flex items-center gap-3">
        <motion.button onClick={onExit} whileTap={{ scale: 0.85 }} aria-label="برگشت"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </motion.button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="font-bold text-gray-800 text-sm">گوش کن و انتخاب کن 🎧</h1>
            <span className="text-sm font-bold text-amber-600">{idx + 1}/{questions.length}</span>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((idx / questions.length) * 100)}
            className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
              animate={{ width: `${(idx / questions.length) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-5 gap-8">
        <motion.button onClick={() => say(q.correct.text, q.correct.slug)} whileTap={{ scale: 0.9 }}
          animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg touch-target"
          aria-label="دوباره گوش کن">
          <span className="text-4xl">🔊</span>
        </motion.button>
        <p className="text-gray-600 persian-text">کدام را شنیدی؟</p>

        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          <AnimatePresence>
            {q.options.map(opt => {
              const isCorrect = opt.slug === q.correct.slug
              const show = picked !== null
              const cls = show
                ? isCorrect ? 'bg-green-100 border-green-400 text-green-700'
                  : opt.slug === picked ? 'bg-red-100 border-red-300 text-red-600' : 'bg-white border-gray-100 text-gray-400'
                : 'bg-white border-gray-100 text-gray-800'
              return (
                <motion.button key={opt.slug} onClick={() => choose(opt.slug)} whileTap={{ scale: 0.95 }}
                  className={`rounded-md border-2 py-6 shadow-sm font-bold text-4xl touch-target ${cls}`}
                  aria-label={`انتخاب ${opt.text}`}>
                  {opt.text}
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
