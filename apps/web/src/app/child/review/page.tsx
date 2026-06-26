'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import QuizCard, { type QuizQuestion, type QuizMode } from '@/components/child/QuizCard'
import Mascot from '@/components/child/Mascot'
import LoadingScreen from '@/components/child/LoadingScreen'
import { playComplete } from '@/lib/sounds'
import { initSpeech } from '@/lib/speech'
import type { Child, Word, ReviewItem } from '@koodakbook/shared'

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

export default function ReviewPage() {
  const router = useRouter()
  const [childId, setChildId] = useState('')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [pool, setPool] = useState<Word[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [correct, setCorrect] = useState(0)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    async function load() {
      const childRes = await api.get<Child[]>('/api/children')
      const child = pickChild(childRes.data ?? [])
      if (child) {
        setChildId(child.id)
        const [reviewRes, wordsRes] = await Promise.all([
          api.get<ReviewItem[]>(`/api/progress/${child.id}/review`),
          api.get<Word[]>('/api/words'),
        ])
        setItems(reviewRes.data ?? [])
        setPool(wordsRes.data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  const questions = useMemo<QuizQuestion[]>(() => {
    if (items.length === 0) return []
    const modes: QuizMode[] = ['match_image', 'listen_tap']
    return items.map(it => {
      const distractors = pickRandom(pool.filter(w => w.id !== it.word.id), 3)
      return {
        mode: modes[Math.floor(Math.random() * modes.length)],
        correctWord: it.word,
        distractorWords: distractors,
      }
    })
  }, [items, pool])

  useEffect(() => {
    if (!done || firedRef.current) return
    firedRef.current = true
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 }, colors: ['#f97316', '#22c55e', '#3b82f6'] })
    playComplete()
  }, [done])

  function report(wordId: string, result: 'correct' | 'incorrect') {
    if (!childId) return
    api.post('/api/progress/word', { child_id: childId, word_id: wordId, status: 'practiced', result })
  }

  function advance() {
    if (idx >= questions.length - 1) setDone(true)
    else setIdx(i => i + 1)
  }

  if (loading) return <LoadingScreen message="در حال آماده‌سازی مرور..." />

  if (items.length === 0 || done) {
    const allCaughtUp = items.length === 0
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
          <Mascot size={130} mood="excited" />
        </motion.div>
        <h1 className="text-3xl font-bold text-gray-800">
          {allCaughtUp ? 'همه را مرور کردی! 🎉' : 'آفرین! مرور تمام شد 🌟'}
        </h1>
        <p className="text-gray-500 persian-text">
          {allCaughtUp ? 'الان کلمه‌ای برای مرور نداری. بعداً برگرد!' : `${correct} از ${questions.length} درست`}
        </p>
        <motion.button
          onClick={() => router.push('/child/home')}
          whileTap={{ scale: 0.96 }}
          className="w-full max-w-xs bg-brand-gradient text-white font-bold py-4 rounded-md text-lg shadow-md"
        >
          برگشت به خانه 🏠
        </motion.button>
      </div>
    )
  }

  const question = questions[idx]
  const progress = (idx / Math.max(questions.length, 1)) * 100

  return (
    <div className="min-h-screen child-bg flex flex-col">
      <div className="bg-white/85 backdrop-blur-md border-b border-amber-100 px-5 py-3 flex items-center gap-3">
        <motion.button
          onClick={() => router.push('/child/home')}
          whileTap={{ scale: 0.85 }}
          aria-label="برگشت"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </motion.button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="font-bold text-gray-800 text-sm">مرور کلمه‌ها 🔄</h1>
            <span className="text-sm font-bold text-amber-600">{idx + 1}/{questions.length}</span>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div className="h-full bg-brand-gradient rounded-full" animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-5 pt-8 overflow-y-auto">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div key={idx} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
              <QuizCard
                question={question}
                onCorrect={() => { if (question.correctWord) report(question.correctWord.id, 'correct'); setCorrect(c => c + 1); advance() }}
                onIncorrect={() => { if (question.correctWord) report(question.correctWord.id, 'incorrect'); advance() }}
                onFlashcardNext={() => { if (question.correctWord) report(question.correctWord.id, 'correct'); advance() }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
