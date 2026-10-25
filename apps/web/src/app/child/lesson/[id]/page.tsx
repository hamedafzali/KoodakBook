'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { celebrate } from '@/lib/confetti'
import Mascot from '@/components/child/Mascot'
import { ClayButton } from '@/components/child/clay'
import { roomBand } from '@/components/child/kit'
import { Icon } from '@/components/icons'
import QuizCard, { type QuizQuestion, type QuizMode } from '@/components/child/QuizCard'
import RewardPopup from '@/components/child/RewardPopup'
import LoadingScreen from '@/components/child/LoadingScreen'
import ErrorState from '@/components/child/ErrorState'
import { playComplete } from '@/lib/sounds'
import { initSpeech } from '@/lib/speech'
import { pickChild } from '@/lib/activeChild'
import type { Lesson, LessonItem, Badge, Child, Promotion } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'

type LessonWithItems = Lesson & { items: LessonItem[] }

/* Build a QuizQuestion from a LessonItem plus available pool for distractors */
function buildQuestion(
  item: LessonItem,
  allItems: LessonItem[],
  childLevel: number,
): QuizQuestion {
  const isFlashcard = childLevel <= 1
  const mode: QuizMode = isFlashcard
    ? 'flashcard'
    : item.word
      ? (['match_image', 'listen_tap', 'name_it'] as QuizMode[])[Math.floor(Math.random() * 3)]
      : 'flashcard'

  if (item.word) {
    const pool = allItems.filter(i => i.word && i.word.id !== item.word!.id).map(i => i.word!)
    const distractors = pickRandom(pool, 3)
    return { mode: mode as QuizMode, correctWord: item.word, distractorWords: distractors }
  }
  if (item.letter) {
    const pool = allItems.filter(i => i.letter && i.letter.id !== item.letter!.id).map(i => i.letter!)
    const distractors = pickRandom(pool, 3)
    return { mode: 'flashcard', correctLetter: item.letter, distractorLetters: distractors }
  }
  return { mode: 'flashcard' }
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export default function LessonPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [lesson, setLesson] = useState<LessonWithItems | null>(null)
  const [childId, setChildId] = useState<string>('')
  const [childLevel, setChildLevel] = useState<number>(1)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [newBadge, setNewBadge] = useState<Badge | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [completed, setCompleted] = useState(false)
  const completedFiredRef = useRef(false)
  // A failed fetch used to leave this page on its loading screen forever (the
  // api client resolves `{ data: null, error }`, it never rejects). `attempt`
  // re-runs the load from the error screen's retry.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Saving the finished lesson can fail (or there's no child to save it for).
  // The child still gets the completion screen -- never stuck on the last
  // question -- with an honest note and a retry.
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const lastScore = useRef(100)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    let cancelled = false
    async function load() {
      const [lessonRes, childRes] = await Promise.all([
        api.get<LessonWithItems>(`/api/lessons/${id}`),
        api.get<Child[]>('/api/children'),
      ])
      if (cancelled) return
      // The child is needed too: without its id nothing the child does here
      // is saved, and the last answer can't complete the lesson.
      if (!lessonRes.data || !childRes.data) {
        setLoadError(lessonRes.error ?? childRes.error ?? 'اتصال برقرار نشد. دوباره تلاش کن')
        return
      }
      setLesson(lessonRes.data)
      const child = pickChild(childRes.data)
      if (child) {
        setChildId(child.id)
        setChildLevel(child.level ?? 1)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, router, attempt])

  /* Fire confetti + sound exactly once when completed becomes true */
  useEffect(() => {
    if (!completed || completedFiredRef.current) return
    completedFiredRef.current = true
    celebrate({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#f97316','#eab308','#22c55e','#3b82f6'] })
    playComplete()
  }, [completed])

  async function handleItemInteraction(wordId: string) {
    if (!childId) return
    await api.post('/api/progress/word', { child_id: childId, word_id: wordId, status: 'practiced' })
  }

  async function saveLesson(score: number) {
    if (!lesson) return null
    // new_badges / promotions are top-level on the response, not under `data`
    // (same contract as /api/progress/story).
    const res = await api.post(
      '/api/progress/lesson',
      { child_id: childId, lesson_id: lesson.id, score }
    ) as { error?: string | null; new_badges?: Badge[]; promotions?: Promotion[] }
    setSaveError(res.error ? res.error : null)
    return res
  }

  async function retrySave() {
    setSaving(true)
    const res = await saveLesson(lastScore.current)
    setSaving(false)
    if (res?.promotions?.length) setPromotions(res.promotions)
    if (res?.new_badges?.[0]) setNewBadge(res.new_badges[0])
  }

  async function handleComplete(correct: number, total: number) {
    if (!lesson) return
    const score = total > 0 ? Math.round((correct / total) * 100) : 100
    lastScore.current = score
    // It used to `return` here without a child, leaving the child on the
    // last question with nothing happening.
    if (!childId) { setSaveError('پیشرفتت ذخیره نشد.'); setCompleted(true); return }
    const res = await saveLesson(score)
    if (!res) return
    if (res.promotions?.length) setPromotions(res.promotions)
    if (res.new_badges?.[0]) setNewBadge(res.new_badges[0])
    else setCompleted(true)
  }

  const questions = useMemo<QuizQuestion[]>(() => {
    if (!lesson) return []
    return lesson.items.map(item => buildQuestion(item, lesson.items, childLevel))
  }, [lesson, childLevel])

  if (loadError) {
    return (
      <ErrorState
        message={loadError}
        onRetry={() => { setLoadError(null); setAttempt(a => a + 1) }}
        backHref="/child/lesson"
        backLabel="برگشت به درس‌ها"
      />
    )
  }
  if (!lesson) return <LoadingScreen message="در حال بارگذاری درس..." />

  const isLast = currentIdx === questions.length - 1
  const progress = ((currentIdx) / Math.max(questions.length, 1)) * 100

  if (completed) {
    const total = correctCount + incorrectCount
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 100
    const mood = score >= 80 ? 'excited' : 'happy'
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        >
          <Mascot size={130} mood={mood} />
        </motion.div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-3xl font-bold text-text-primary">آفرین! <span aria-hidden="true">🌟</span></h1>
          <p className="text-text-secondary mt-1 persian-text">درس «{lesson.title}» تمام شد</p>
        </motion.div>

        {/* Score card */}
        <motion.div
          className="bg-white rounded-2xl shadow-card p-5 w-full max-w-xs text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <div className="flex justify-around">
            <div>
              <p className="text-3xl font-bold text-green-700">{toPersianDigits(correctCount)}</p>
              <p className="text-xs text-text-secondary mt-0.5">درست <span aria-hidden="true">✅</span></p>
            </div>
            <div className="w-px bg-surface-subtle" />
            <div>
              <p className="text-3xl font-bold text-red-600">{toPersianDigits(incorrectCount)}</p>
              <p className="text-xs text-text-secondary mt-0.5">نادرست <span aria-hidden="true">❌</span></p>
            </div>
            <div className="w-px bg-surface-subtle" />
            <div>
              <p className="text-3xl font-bold text-amber-700">{toPersianDigits(score)}٪</p>
              <p className="text-xs text-text-secondary mt-0.5">نمره</p>
            </div>
          </div>
        </motion.div>

        {saveError && (
          <div role="alert" className="w-full max-w-xs rounded-2xl p-4 text-center flex flex-col items-center gap-2"
            style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }}>
            <p className="font-bold text-small persian-text">این بار ذخیره نشد</p>
            <p className="text-small persian-text">{saveError}</p>
            {childId && (
              <ClayButton size="md" onClick={retrySave} disabled={saving}>
                {saving ? 'در حال ذخیره...' : 'دوباره ذخیره کن'}
              </ClayButton>
            )}
          </div>
        )}

        {promotions.length > 0 && (
          <motion.div
            /* Was white text on a rewards bright→deep gradient: the bright
               end is saffron #FBBF24, where white measures ~1.7:1. The ramp's
               own pairing is dark ink on bright (DESIGN_CHARTER.md). */
            className="rounded-3xl shadow-card p-4 w-full max-w-xs text-center"
            style={{ background: 'var(--ramp-rewards-bright)', color: 'var(--ramp-rewards-ink)' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55, type: 'spring', stiffness: 300, damping: 16 }}
          >
            <p className="text-2xl mb-1" aria-hidden="true">🔓✨</p>
            <p className="font-bold">محتوای جدید باز شد!</p>
            <p className="text-xs mt-0.5 persian-text">درس‌ها و داستان‌های تازه در خانه منتظرت هستند</p>
          </motion.div>
        )}

        <motion.div
          className="w-full max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <ClayButton ramp="lessons" size="lg" onClick={() => router.push('/child/home')}>
            برگشت به خانه <span aria-hidden="true">🏠</span>
          </ClayButton>
        </motion.div>
      </div>
    )
  }

  const question = questions[currentIdx]
  // A lesson with no items has no first question: that used to be an endless
  // loading screen. It's content that isn't there, so no retry.
  if (!question) {
    return <ErrorState title="این درس هنوز تمرینی ندارد" backHref="/child/lesson" backLabel="برگشت به درس‌ها" />
  }

  return (
    <div className="min-h-screen child-bg flex flex-col">
      {newBadge && (
        <RewardPopup
          badge={newBadge}
          onClose={() => { setNewBadge(null); setCompleted(true) }}
        />
      )}

      {/* Header with progress — in the lessons room's own band (roomBand),
          the same band /child/lesson's PageHeader wears. */}
      <div style={roomBand('lessons')} className="backdrop-blur-md border-b rounded-b-[1.75rem] shadow-card px-5 py-3 flex items-center gap-3">
        <motion.button
          onClick={() => router.back()}
          whileTap={{ scale: 0.85 }}
          aria-label="برگشت"
          className="min-w-[56px] min-h-[56px] flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors"
        >
          <Icon name="back" size="md" strokeWidth={2.5} />
        </motion.button>

        {/* min-w-0 on both levels: without it a long lesson title can't
            shrink, so `truncate` never engages and the counter is pushed off
            a 360px screen. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="font-bold text-text-primary text-sm truncate min-w-0">{lesson.title}</h1>
            <span className="text-sm font-bold text-lessons-ink shrink-0 ms-2 persian-text">
              {toPersianDigits(currentIdx + 1)} از {toPersianDigits(questions.length)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label={`پیشرفت درس: ${toPersianDigits(Math.round(progress))} درصد`}
            className="h-2 bg-surface-subtle rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-brand-gradient rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      </div>

      {/* Quiz area — vertically centered rather than pinned to the top.
          At common phone heights the card + button only filled the top
          ~55% of this area, leaving the rest empty cream below; nothing in
          QuizCard needs the top-alignment, so centering it here is the
          direct fix rather than growing the card artificially. */}
      <div className="flex-1 flex items-center justify-center p-5 overflow-y-auto">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <QuizCard
                ramp="lessons"
                question={question}
                onCorrect={() => {
                  question.correctWord && handleItemInteraction(question.correctWord.id)
                  setCorrectCount(c => c + 1)
                  if (isLast) {
                    handleComplete(correctCount + 1, correctCount + 1 + incorrectCount)
                  } else {
                    setCurrentIdx(i => i + 1)
                  }
                }}
                onIncorrect={() => {
                  setIncorrectCount(c => c + 1)
                  if (isLast) {
                    handleComplete(correctCount, correctCount + incorrectCount + 1)
                  } else {
                    setCurrentIdx(i => i + 1)
                  }
                }}
                onFlashcardNext={() => {
                  question.correctWord && handleItemInteraction(question.correctWord.id)
                  if (isLast) {
                    handleComplete(questions.length, questions.length)
                  } else {
                    setCurrentIdx(i => i + 1)
                  }
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
