'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { enterChildMode } from '@/lib/mode'
import Mascot from '@/components/child/Mascot'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import LoadingScreen from '@/components/child/LoadingScreen'
import { speakOrPlay, speakPersian, stopSpeaking, initSpeech } from '@/lib/speech'
import { useSpeaking } from '@/lib/useSpeaking'
import { playTap, playSuccess } from '@/lib/sounds'
import { wordEmoji, currentProbeStep, recordProbeAnswer, emptyProbeResults } from '@koodakbook/shared'
import type { Child, PlacementProbe, ProbeChoice, ProbeResults, ProbeStep } from '@koodakbook/shared'

type Phase = 'loading' | 'intro' | 'question' | 'feedback' | 'done'

function choiceFace(c: ProbeChoice): string {
  if (c.kind === 'letter') return c.character ?? c.persian
  return wordEmoji(c.english) ?? c.persian
}

export default function PlacementPage() {
  return (
    <Suspense fallback={<LoadingScreen message="آماده‌سازی بازی..." />}>
      <PlacementInner />
    </Suspense>
  )
}

// `?mode=reprobe` runs this as periodic re-placement instead of onboarding
// (docs/re-placement-flow-design.md §2) — see the mobile client's equivalent
// (apps/mobile/app/placement.tsx) for the full rationale; kept in sync here
// so the two clients can't drift on the parts that must stay identical.
//
// Placement probe rebuild (docs/placement-probe-rebuild.md): the fixed
// 4-question array is gone. The server hands back an item BANK (a mid item
// per strand plus its hard/easy branch candidates); `@koodakbook/shared`'s
// probeFlow walks that bank strand-by-strand as answers come in, so this file
// never decides the branch rule itself — mobile shares the exact same logic.
// Onboarding and reprobe now progress identically (§6): the pre-rebuild
// "abort the whole probe at the first miss" behaviour is gone — a branch to
// an easier item is still forward motion, never a stop, for either flow.
function PlacementInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReprobe = searchParams.get('mode') === 'reprobe'
  const [child, setChild] = useState<Child | null>(null)
  const [bank, setBank] = useState<PlacementProbe | null>(null)
  const [results, setResults] = useState<ProbeResults>(emptyProbeResults())
  const [phase, setPhase] = useState<Phase>('loading')
  const [lastCorrect, setLastCorrect] = useState(false)
  const [finalLevel, setFinalLevel] = useState(1)
  // A ref because finish() needs the LATEST results synchronously, before the
  // setResults state update from the final answer has necessarily flushed.
  const resultsRef = useRef<ProbeResults>(emptyProbeResults())

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [childRes, probeRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<PlacementProbe>('/api/placement/probe'),
      ])
      const c = pickChild(childRes.data ?? [])
      if (!c) { router.push('/onboarding'); return }
      setChild(c)
      if (!probeRes.data || !currentProbeStep(probeRes.data, emptyProbeResults())) {
        // No usable probe content — skip gracefully, keep the default level.
        enterChildMode()
        router.push('/child/home')
        return
      }
      setBank(probeRes.data)
      // Simorgh hosts: greet first, and the «بزن بریم» tap doubles as the user
      // gesture browsers require before the first listen-question can auto-play.
      setPhase('intro')
    }
    load()
  }, [router])

  const step: ProbeStep | null = bank ? currentProbeStep(bank, results) : null
  const q = step?.question
  const speaking = useSpeaking()   // syncs Simorgh's talking mouth to her voice

  // Simorgh speaks her welcome when the intro appears.
  useEffect(() => {
    if (phase !== 'intro' || !child) return
    initSpeech()
    const t = setTimeout(() => speakPersian(`سلام ${child.name}! من سیمرغم! بیا با هم یک بازی کوچولو کنیم!`), 400)
    return () => clearTimeout(t)
  }, [phase, child])

  // Auto-play the audio prompt when a listen-question appears.
  useEffect(() => {
    if (phase !== 'question' || !q || q.mode !== 'listen') return
    initSpeech()
    const correct = q.choices.find(c => c.id === q.correct_id)
    const t = setTimeout(() => speakOrPlay(q.audio_url, correct?.persian ?? ''), 350)
    return () => clearTimeout(t)
  }, [phase, q])

  async function finish() {
    if (child) {
      if (isReprobe) {
        await api.post(`/api/placement/${child.id}/reprobe-result`, resultsRef.current)
      } else {
        // Scoring (§5) now lives server-side — it needs gate.ts's w(n) for
        // confidence — so the level for the reveal screen comes back on the
        // response instead of being computed here before the request.
        const res = await api.post<Child>('/api/placement/result', { child_id: child.id, results: resultsRef.current })
        if (res.data) setFinalLevel(res.data.level)
      }
    }
    setPhase('done')
    enterChildMode()
    setTimeout(() => router.push('/child/home'), 2600)
  }

  function answer(choice: ProbeChoice) {
    if (phase !== 'question' || !step) return
    const ok = choice.id === step.question.correct_id
    setLastCorrect(ok)
    if (ok) playSuccess(); else playTap()
    setPhase('feedback')

    setTimeout(() => {
      const updated = recordProbeAnswer(resultsRef.current, step, ok)
      resultsRef.current = updated
      setResults(updated)
      if (bank && currentProbeStep(bank, updated)) {
        setPhase('question')
      } else {
        finish()
      }
    }, 1100)
  }

  if (phase === 'loading') return <LoadingScreen message="آماده‌سازی بازی..." />

  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 text-center">
        <CharacterAvatar slug="simorgh" size={150} mood="happy" talking={speaking} />
        <h1 className="text-2xl font-bold text-gray-800 mt-5 persian-text">سلام {child?.name}! من سیمرغم 🌟</h1>
        <p className="text-gray-600 mt-2 persian-text leading-relaxed max-w-xs">
          بیا با هم یک بازی کوچولو کنیم تا ببینم چی بلدی — امتحان نیست، فقط بازیه!
        </p>
        <motion.button whileTap={{ scale: 0.94, y: 4 }}
          onClick={() => { playTap(); stopSpeaking(); setPhase('question') }}
          className="mt-8 bg-amber-500 text-white font-bold text-xl rounded-2xl px-12 py-4 shadow-lg border-b-[6px] border-amber-600 touch-target">
          بزن بریم! 🎈
        </motion.button>
      </div>
    )
  }

  if (phase === 'done') {
    const labels = ['', 'تازه‌کار', 'آشنا با کلمه‌ها', 'خواننده‌ی کوچک', 'خواننده‌ی ماهر']
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <Mascot size={120} mood="excited" />
        </motion.div>
        <h1 className="text-2xl font-bold text-gray-800 mt-4">آفرین {child?.name}! 🎉</h1>
        {/* Re-placement never reveals a level — a recurring scorecard is
            exactly the signal the gate/trophy split exists to hide, and a
            re-placement result can legitimately move the gate down (§2/§3). */}
        <p className="text-gray-600 mt-2 persian-text">
          {isReprobe ? 'خیلی خوب بود! 🌟' : <>از اینجا شروع می‌کنیم: <b>{labels[finalLevel]}</b></>}
        </p>
        <p className="text-sm text-gray-400 mt-4 persian-text">در حال رفتن به خانه...</p>
      </div>
    )
  }

  if (!q) return <LoadingScreen message="..." />

  return (
    <div className="min-h-screen child-bg flex flex-col">
      {/* No difficulty tier, question number, or "X of N" counter — the
          child's staircase branch is never revealed (§6). Simorgh's own
          animation beats are enough progress feedback for this age group. */}
      <div className="flex justify-center pt-8">
        <CharacterAvatar slug="simorgh" size={64} mood={phase === 'feedback' ? (lastCorrect ? 'excited' : 'idle') : 'happy'} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6">
        <p className="text-lg font-bold text-gray-800 text-center persian-text">{q.prompt}</p>

        {/* Prompt media */}
        {q.mode === 'listen' ? (
          <button
            onClick={() => { playTap(); const correct = q.choices.find(c => c.id === q.correct_id); speakOrPlay(q.audio_url, correct?.persian ?? '') }}
            className="w-28 h-28 rounded-full bg-white shadow-lg flex items-center justify-center text-5xl touch-target active:scale-95 transition-transform"
            aria-label="دوباره گوش کن"
          >
            🔊
          </button>
        ) : (
          <div className="bg-white rounded-lg shadow-lg px-6 py-6 sm:px-10 sm:py-8">
            <span className="text-4xl sm:text-6xl font-bold text-gray-800">{q.show_text}</span>
          </div>
        )}

        {/* Choices */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm" role="group" aria-label="گزینه‌ها">
          {q.choices.map(c => (
            <motion.button
              key={c.id}
              onClick={() => answer(c)}
              disabled={phase !== 'question'}
              whileTap={{ scale: 0.92 }}
              className="aspect-square bg-white rounded-[1.5rem] shadow-md flex flex-col items-center justify-center gap-1 disabled:opacity-60 touch-target"
              aria-label={c.persian}
            >
              <span className={c.kind === 'letter' ? 'text-3xl sm:text-5xl font-bold text-gray-800' : 'text-3xl sm:text-5xl'}>{choiceFace(c)}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Feedback overlay */}
      <AnimatePresence>
        {phase === 'feedback' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-2">
              <Mascot size={100} mood={lastCorrect ? 'excited' : 'idle'} />
              <p className={`font-bold text-xl ${lastCorrect ? 'text-green-600' : 'text-amber-600'}`}>
                {lastCorrect ? 'آفرین! 🌟' : 'اشکالی نداره 💛'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
