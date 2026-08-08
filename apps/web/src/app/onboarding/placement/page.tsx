'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { wordEmoji, scorePlacement } from '@koodakbook/shared'
import type { Child, PlacementProbe, ProbeQuestion, ProbeChoice } from '@koodakbook/shared'

type Phase = 'loading' | 'intro' | 'question' | 'feedback' | 'done'

function choiceFace(c: ProbeChoice): string {
  if (c.kind === 'letter') return c.character ?? c.persian
  return wordEmoji(c.english) ?? c.persian
}

export default function PlacementPage() {
  const router = useRouter()
  const [child, setChild] = useState<Child | null>(null)
  const [questions, setQuestions] = useState<ProbeQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [lastCorrect, setLastCorrect] = useState(false)
  const [finalLevel, setFinalLevel] = useState(1)
  // passed[i] = did the child answer question i correctly (false once they stop)
  const passed = useRef<boolean[]>([])

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
      if (!probeRes.data?.questions?.length) {
        // No probe content — skip gracefully, keep the default level.
        enterChildMode()
        router.push('/child/home')
        return
      }
      setQuestions(probeRes.data.questions)
      // Simorgh hosts: greet first, and the «بزن بریم» tap doubles as the user
      // gesture browsers require before the first listen-question can auto-play.
      setPhase('intro')
    }
    load()
  }, [router])

  const q = questions[idx]
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

  async function finish(answers: boolean[]) {
    const { level, strands } = scorePlacement(answers)
    setFinalLevel(level)
    setPhase('done')
    if (child) {
      await api.post('/api/placement/result', { child_id: child.id, level, strands })
    }
    enterChildMode()
    setTimeout(() => router.push('/child/home'), 2600)
  }

  function answer(choice: ProbeChoice) {
    if (phase !== 'question' || !q) return
    const ok = choice.id === q.correct_id
    passed.current[idx] = ok
    setLastCorrect(ok)
    if (ok) playSuccess(); else playTap()
    setPhase('feedback')

    setTimeout(() => {
      // Stop at the first miss (items get harder) or when the bank is exhausted.
      if (!ok || idx + 1 >= questions.length) {
        const answers = questions.map((_, i) => passed.current[i] ?? false)
        finish(answers)
      } else {
        setIdx(i => i + 1)
        setPhase('question')
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
        <p className="text-gray-600 mt-2 persian-text">از اینجا شروع می‌کنیم: <b>{labels[finalLevel]}</b></p>
        <p className="text-sm text-gray-400 mt-4 persian-text">در حال رفتن به خانه...</p>
      </div>
    )
  }

  if (!q) return <LoadingScreen message="..." />

  return (
    <div className="min-h-screen child-bg flex flex-col">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-8" aria-label={`سوال ${idx + 1} از ${questions.length}`}>
        {questions.map((_, i) => (
          <div key={i} className={`h-2.5 rounded-full transition-all ${i === idx ? 'w-7 bg-amber-500' : i < idx ? 'w-2.5 bg-amber-300' : 'w-2.5 bg-white/60'}`} />
        ))}
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
          <div className="bg-white rounded-lg shadow-lg px-10 py-8">
            <span className="text-6xl font-bold text-gray-800">{q.show_text}</span>
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
              <span className={c.kind === 'letter' ? 'text-5xl font-bold text-gray-800' : 'text-5xl'}>{choiceFace(c)}</span>
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
