'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { celebrate } from '@/lib/confetti'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import QuizCard, { type QuizQuestion } from '@/components/child/QuizCard'
import Mascot from '@/components/child/Mascot'
import { ClayButton } from '@/components/child/clay'
import { Icon } from '@/components/icons'
import LoadingScreen from '@/components/child/LoadingScreen'
import ErrorState from '@/components/child/ErrorState'
import { playComplete } from '@/lib/sounds'
import { initSpeech } from '@/lib/speech'
import type { Child, Word, ReviewItem } from '@koodakbook/shared'
import { buildReviewQuestions, buildPaddingQuestions, toPersianDigits } from '@koodakbook/shared'

// Frustration loop (mig-051): the backend attaches `easing`/`needsReteach` to
// each due word — thresholds live server-side (frustration.ts) so this file
// never has to know the numbers. What to DO about the flags (mode choice,
// distractor selection, the re-teach beat, win-padding) lives in
// `@koodakbook/shared`'s reviewFrustration module, shared with mobile so the
// two clients can't drift on it again.

export default function ReviewPage() {
  const router = useRouter()
  const [childId, setChildId] = useState('')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [pool, setPool] = useState<Word[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [correct, setCorrect] = useState(0)
  // Stage 3 padding (mig-051): quick, unscored wins appended when a word is
  // still missed right after its re-teach beat, so the session doesn't end on
  // a loss streak. Kept separate from `questions` (which is a pure function of
  // items/pool) rather than mutated into it.
  const [extraQuestions, setExtraQuestions] = useState<QuizQuestion[]>([])
  // Which words have already had their re-teach flashcard shown this session —
  // purely a same-session sequencing fact, not something derived from the
  // threshold numbers (which this file never needs to know).
  const reteachShownRef = useRef<Set<string>>(new Set())
  const sessionWinsRef = useRef<Word[]>([])
  const firedRef = useRef(false)
  // A failed fetch used to land on «همه را مرور کردی!» — a celebration for
  // a review that never loaded. Failed is not "nothing due".
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    let cancelled = false
    const fail = (e: string | null) => { setLoadError(e ?? 'اتصال برقرار نشد. دوباره تلاش کن'); setLoading(false) }
    async function load() {
      const childRes = await api.get<Child[]>('/api/children')
      if (cancelled) return
      if (!childRes.data) { fail(childRes.error); return }
      const child = pickChild(childRes.data)
      if (child) {
        setChildId(child.id)
        const [reviewRes, wordsRes] = await Promise.all([
          api.get<ReviewItem[]>(`/api/progress/${child.id}/review`),
          api.get<Word[]>('/api/words'),
        ])
        if (cancelled) return
        if (!reviewRes.data || !wordsRes.data) { fail(reviewRes.error ?? wordsRes.error); return }
        setItems(reviewRes.data)
        setPool(wordsRes.data)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [router, attempt])

  const questions = useMemo<QuizQuestion[]>(
    () => (items.length === 0 ? [] : buildReviewQuestions(items, pool)),
    [items, pool],
  )

  const allQuestions = useMemo(() => [...questions, ...extraQuestions], [questions, extraQuestions])

  // Derived from idx/allQuestions rather than checked imperatively inside
  // advance() — extraQuestions can land in the same tick as the advance that
  // needed it, and an imperative check risks reading the pre-append length.
  useEffect(() => {
    if (allQuestions.length > 0 && idx >= allQuestions.length) setDone(true)
  }, [idx, allQuestions.length])

  useEffect(() => {
    if (!done || firedRef.current) return
    firedRef.current = true
    celebrate({ particleCount: 90, spread: 80, origin: { y: 0.5 }, colors: ['#f97316', '#22c55e', '#3b82f6'] })
    playComplete()
  }, [done])

  function report(wordId: string, result: 'correct' | 'incorrect') {
    if (!childId) return
    api.post('/api/progress/word', { child_id: childId, word_id: wordId, status: 'practiced', result })
  }

  function advance() {
    setIdx(i => i + 1)
  }

  if (loading) return <LoadingScreen message="در حال آماده‌سازی مرور..." />
  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => { setLoadError(null); setLoading(true); setAttempt(a => a + 1) }} />
  }

  // `done` is set reactively one render after idx crosses allQuestions.length
  // (see the useEffect above) — guard the in-between render rather than index
  // into allQuestions with an out-of-range idx.
  if (items.length === 0 || done || idx >= allQuestions.length) {
    const allCaughtUp = items.length === 0
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
          <Mascot size={130} mood="excited" />
        </motion.div>
        <h1 className="font-display text-h1 font-black text-text-primary">
          {allCaughtUp ? 'همه را مرور کردی! ' : 'آفرین! مرور تمام شد '}
          <span aria-hidden="true">{allCaughtUp ? '🎉' : '🌟'}</span>
        </h1>
        <p className="text-body text-text-secondary persian-text">
          {allCaughtUp ? 'الان کلمه‌ای برای مرور نداری. بعداً برگرد!' : `${toPersianDigits(correct)} از ${toPersianDigits(allQuestions.length)} درست`}
        </p>
        <ClayButton ramp="review" size="lg" className="max-w-xs" onClick={() => router.push('/child/home')}>
          برگشت به خانه <span aria-hidden="true">🏠</span>
        </ClayButton>
      </div>
    )
  }

  const question = allQuestions[idx]
  const progress = (idx / Math.max(allQuestions.length, 1)) * 100

  return (
    <div className="min-h-screen child-bg flex flex-col">
      <div className="bg-white/85 backdrop-blur-md border-b border-amber-100 px-5 py-3 flex items-center gap-3">
        <motion.button
          onClick={() => router.push('/child/home')}
          whileTap={{ scale: 0.85 }}
          aria-label="برگشت"
          className="min-w-[56px] min-h-[56px] flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
        >
          <Icon name="back" size="md" strokeWidth={2.5} />
        </motion.button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h1 className="font-bold text-text-primary text-sm">مرور کلمه‌ها <span aria-hidden="true">🔄</span></h1>
            <span className="text-sm font-bold text-amber-700 shrink-0 persian-text">
              {toPersianDigits(idx + 1)} از {toPersianDigits(allQuestions.length)}
            </span>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={`پیشرفت مرور: ${toPersianDigits(Math.round(progress))} درصد`} className="h-2 bg-surface-subtle rounded-full overflow-hidden">
            <motion.div className="h-full bg-brand-gradient rounded-full" animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-5 pt-8 overflow-y-auto">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div key={idx} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
              <QuizCard
                ramp="review"
                question={question}
                onCorrect={() => {
                  if (question.correctWord) {
                    report(question.correctWord.id, 'correct')
                    sessionWinsRef.current.push(question.correctWord)
                  }
                  setCorrect(c => c + 1)
                  advance()
                }}
                onIncorrect={() => {
                  const word = question.correctWord
                  if (word) {
                    report(word.id, 'incorrect')
                    // Stage 3: still wrong right after its re-teach beat — pad the
                    // rest of THIS session with a couple of already-correct wins
                    // from earlier, rather than fetching mastered words fresh, so
                    // the session doesn't end on a loss streak (bench happens
                    // server-side via missIntervalDays; this is purely cosmetic).
                    if (reteachShownRef.current.has(word.id)) {
                      const padding = buildPaddingQuestions(sessionWinsRef.current, 2)
                      if (padding.length > 0) setExtraQuestions(q => [...q, ...padding])
                    }
                  }
                  advance()
                }}
                onFlashcardNext={() => {
                  // No-scoring exposure (both the stage-2 re-teach beat and the
                  // stage-3 win-padding flashcards) — must NOT report 'correct',
                  // or a re-teach would silently inflate the Leitner box.
                  if (question.correctWord) reteachShownRef.current.add(question.correctWord.id)
                  advance()
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
