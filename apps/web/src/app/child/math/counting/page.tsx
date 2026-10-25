'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { celebrate } from '@/lib/confetti'
import { api } from '@/lib/api'
import LoadingScreen from '@/components/child/LoadingScreen'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { toPersianDigits, numberToPersianWord, childAge, shufflePM, distractors, sayNumber, sayPhrase } from '@/lib/persianMath'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import { ClayButton, answerVars, softClayVars } from '@/components/child/clay'
import { useTimers } from '@/lib/useTimers'
import Mascot from '@/components/child/Mascot'
import { playTap, playSuccess, playComplete } from '@/lib/sounds'
import { initSpeech } from '@/lib/speech'
import type { Child } from '@koodakbook/shared'

/* شمارش (ages 3–5) — tap-to-count. The child taps every fruit; each tap
 * speaks the next number («یک… دو…»). When all are counted they answer
 * «چند تا بود؟». Counting aloud WITH the tap is the lesson — one-to-one
 * correspondence in Persian. Under 5 → up to 5 items; at 5 → up to 10. */

// EMOJI-CONTENT: the objects being counted. This is the lesson content itself.
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

  // Was `return null`: a blank white stage (not even child-bg) until the
  // child's age arrived. Same loading screen as every other child page.
  if (maxN === null) return <LoadingScreen />
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
  // Round advance + voice lines die with the screen (were bare setTimeouts).
  const later = useTimers()
  const r = rounds[idx]
  const allCounted = tapped.size === r.count
  const done = idx >= ROUNDS

  useEffect(() => {
    if (done) { playComplete(); celebrate({ particleCount: 110, spread: 85, origin: { y: 0.45 }, colors: ['#34d399', '#fbbf24', '#f472b6'] }) }
  }, [done])

  function tapItem(i: number) {
    if (tapped.has(i) || allCounted) return
    playTap()
    const next = new Set(tapped).add(i)
    setTapped(next)
    sayNumber(next.size)   // the count IS the audio (recorded clip, TTS fallback)
    if (next.size === r.count) later(() => sayPhrase('q-chandta', 'چند تا بود؟'), 900)
  }

  function answer(n: number) {
    if (picked !== null || !allCounted) return
    setPicked(n)
    const ok = n === r.count
    if (ok) { playSuccess(); setStars(s => s + 1); sayPhrase('afarin', 'آفرین!') }
    else sayNumber(r.count)
    later(() => { setPicked(null); setTapped(new Set()); setIdx(i => i + 1) }, 1400)
  }

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
        <Mascot size={130} mood="excited" />
      </motion.div>
      <h1 className="text-3xl font-bold text-text-primary">چه شمارشگری! <span aria-hidden="true">🌟</span></h1>
      <p className="text-text-primary persian-text">{toPersianDigits(stars)} ستاره از {toPersianDigits(ROUNDS)} تا گرفتی</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <ClayButton ramp="math" size="lg" onClick={onReplay}>دوباره <span aria-hidden="true">🔁</span></ClayButton>
        <motion.button onClick={onHome} whileTap={{ scale: 0.96 }}
          className="w-full py-3.5 rounded-2xl border-2 border-border text-text-secondary font-bold min-h-[56px]">دنیای اعداد <span aria-hidden="true">🏠</span></motion.button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="شمارش" subtitle="ضربه بزن و بشمار" module="math" fallback="/child/math" />

      <div className="px-4 pt-5 max-w-md mx-auto space-y-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary persian-text">مرحله {toPersianDigits(idx + 1)} از {toPersianDigits(ROUNDS)}</span>
          <span className="text-amber-500" role="img" aria-label={`${toPersianDigits(stars)} ستاره`}>{'⭐'.repeat(stars)}</span>
        </div>

        {/* Tap stage — big targets for small fingers */}
        <div style={softClayVars('math')} className="clay-static p-5 min-h-[220px]">
          <p className="text-center text-text-primary persian-text text-sm mb-4">
            {allCounted ? 'حالا بگو: چند تا بود؟' : 'روی همه ضربه بزن و با من بشمار!'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {Array.from({ length: r.count }, (_, i) => (
              <motion.button key={i} onClick={() => tapItem(i)}
                whileTap={{ scale: 0.85 }}
                animate={tapped.has(i) ? { scale: [1, 1.35, 1.1], rotate: [0, 10, 0] } : {}}
                aria-label={tapped.has(i) ? `شمرده شد` : `بشمار`}
                className={`text-5xl w-16 h-16 rounded-2xl flex items-center justify-center touch-target-child transition ${
                  tapped.has(i) ? 'bg-emerald-100' : 'bg-emerald-50 hover:bg-emerald-100'}`}>
                {r.emoji}
              </motion.button>
            ))}
          </div>
          {tapped.size > 0 && (
            <motion.p key={tapped.size} initial={{ scale: 0.6 }} animate={{ scale: 1 }}
              className="text-center mt-4 text-4xl font-bold text-emerald-600">
              {toPersianDigits(tapped.size)}
              <span className="block text-base text-emerald-700 mt-1">{numberToPersianWord(tapped.size)}</span>
            </motion.p>
          )}
        </div>

        {/* Answer row appears once everything is counted */}
        <div className={`grid grid-cols-3 gap-3 transition-opacity ${allCounted ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          {r.options.map(n => {
            const show = picked !== null
            // Shared answer faces (clay.tsx answerVars = mobile answerRamps):
            // math's soft clay, then right = bright green, wrong pick = pale rose.
            const state = !show ? null : n === r.count ? 'right' : n === picked ? 'wrong' : null
            return (
              /* disabled until everything is counted: the row was only
                 faded + pointer-events-none, so keyboard and screen-reader
                 users could still reach (and "press") answers that do nothing. */
              <motion.button key={n} onClick={() => answer(n)} whileTap={{ scale: 0.94 }}
                disabled={!allCounted}
                className="clay-option py-5 font-bold touch-target-child" style={answerVars(state, 'math')}
                aria-label={`${numberToPersianWord(n)}${!show ? '' : n === picked ? (n === r.count ? '، درست' : '، نادرست') : n === r.count ? '، جواب درست' : ''}`}>
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
