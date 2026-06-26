'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import Mascot from '@/components/child/Mascot'
import LoadingScreen from '@/components/child/LoadingScreen'
import { speakOrPlay, initSpeech } from '@/lib/speech'
import { playTap, playSuccess } from '@/lib/sounds'
import { wordEmoji } from '@koodakbook/shared'
import type { Child, PlacementProbe, ProbeQuestion, ProbeChoice, Strand } from '@koodakbook/shared'

type Phase = 'loading' | 'question' | 'feedback' | 'done'

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
        router.push('/child/home')
        return
      }
      setQuestions(probeRes.data.questions)
      setPhase('question')
    }
    load()
  }, [router])

  const q = questions[idx]

  // Auto-play the audio prompt when a listen-question appears.
  useEffect(() => {
    if (phase !== 'question' || !q || q.mode !== 'listen') return
    initSpeech()
    const correct = q.choices.find(c => c.id === q.correct_id)
    const t = setTimeout(() => speakOrPlay(q.audio_url, correct?.persian ?? ''), 350)
    return () => clearTimeout(t)
  }, [phase, q])

  async function finish(answers: boolean[]) {
    // Consecutive passes from the start → starting stage (1–4).
    let streak = 0
    for (const ok of answers) { if (ok) streak++; else break }
    const level = Math.min(4, 1 + streak) as 1 | 2 | 3 | 4
    // One probe item per strand: a pass lifts that strand to level 2, else 1.
    const strands: Record<Exclude<Strand, 'P'>, number> = {
      V: answers[0] ? 2 : 1,
      D: answers[1] ? 2 : 1,
      F: answers[2] ? 2 : 1,
      C: answers[3] ? 2 : 1,
    }
    setFinalLevel(level)
    setPhase('done')
    if (child) {
      await api.post('/api/placement/result', { child_id: child.id, level, strands })
    }
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
