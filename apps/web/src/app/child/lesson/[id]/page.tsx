'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import Mascot from '@/components/child/Mascot'
import QuizCard, { type QuizQuestion, type QuizMode } from '@/components/child/QuizCard'
import RewardPopup from '@/components/child/RewardPopup'
import LoadingScreen from '@/components/child/LoadingScreen'
import { playComplete } from '@/lib/sounds'
import { initSpeech } from '@/lib/speech'
import { pickChild } from '@/lib/activeChild'
import type { Lesson, LessonItem, Badge, Child, Promotion } from '@koodakbook/shared'

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

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    async function load() {
      const [lessonRes, childRes] = await Promise.all([
        api.get<LessonWithItems>(`/api/lessons/${id}`),
        api.get<Child[]>('/api/children'),
      ])
      if (lessonRes.data) setLesson(lessonRes.data)
      const child = pickChild(childRes.data ?? [])
      if (child) {
        setChildId(child.id)
        setChildLevel(child.level ?? 1)
      }
    }
    load()
  }, [id, router])

  /* Fire confetti + sound exactly once when completed becomes true */
  useEffect(() => {
    if (!completed || completedFiredRef.current) return
    completedFiredRef.current = true
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#f97316','#eab308','#22c55e','#3b82f6'] })
    playComplete()
  }, [completed])

  async function handleItemInteraction(wordId: string) {
    if (!childId) return
    await api.post('/api/progress/word', { child_id: childId, word_id: wordId, status: 'practiced' })
  }

  async function handleComplete(correct: number, total: number) {
    if (!childId || !lesson) return
    const score = total > 0 ? Math.round((correct / total) * 100) : 100
    const res = await api.post<{ new_badges: Badge[]; promotions: Promotion[] }>(
      '/api/progress/lesson',
      { child_id: childId, lesson_id: lesson.id, score }
    )
    if (res.data?.promotions?.length) setPromotions(res.data.promotions)
    if (res.data?.new_badges?.[0]) setNewBadge(res.data.new_badges[0])
    else setCompleted(true)
  }

  const questions = useMemo<QuizQuestion[]>(() => {
    if (!lesson) return []
    return lesson.items.map(item => buildQuestion(item, lesson.items, childLevel))
  }, [lesson, childLevel])

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
          <h1 className="text-3xl font-bold text-gray-800">آفرین! 🌟</h1>
          <p className="text-gray-500 mt-1 persian-text">درس «{lesson.title}» تمام شد</p>
        </motion.div>

        {/* Score card */}
        <motion.div
          className="bg-white rounded-lg shadow-lg p-5 w-full max-w-xs text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <div className="flex justify-around">
            <div>
              <p className="text-3xl font-bold text-green-600">{correctCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">درست ✅</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-3xl font-bold text-red-400">{incorrectCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">نادرست ❌</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-3xl font-bold text-amber-500">{score}٪</p>
              <p className="text-xs text-gray-500 mt-0.5">نمره</p>
            </div>
          </div>
        </motion.div>

        {promotions.length > 0 && (
          <motion.div
            className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-[1.5rem] shadow-lg p-4 w-full max-w-xs text-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55, type: 'spring', stiffness: 300, damping: 16 }}
          >
            <p className="text-2xl mb-1">🔓✨</p>
            <p className="font-bold">محتوای جدید باز شد!</p>
            <p className="text-xs text-white/85 mt-0.5 persian-text">درس‌ها و داستان‌های تازه در خانه منتظرت هستند</p>
          </motion.div>
        )}

        <motion.button
          onClick={() => router.push('/child/home')}
          className="w-full max-w-xs bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold py-4 rounded-md text-lg shadow-md touch-target"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
        >
          برگشت به خانه 🏠
        </motion.button>
      </div>
    )
  }

  const question = questions[currentIdx]
  if (!question) return <LoadingScreen />

  return (
    <div className="min-h-screen child-bg flex flex-col">
      {newBadge && (
        <RewardPopup
          badge={newBadge}
          onClose={() => { setNewBadge(null); setCompleted(true) }}
        />
      )}

      {/* Header with progress */}
      <div className="bg-white/85 backdrop-blur-md border-b border-amber-100 px-5 py-3 flex items-center gap-3">
        <motion.button
          onClick={() => router.back()}
          whileTap={{ scale: 0.85 }}
          aria-label="برگشت"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </motion.button>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="font-bold text-gray-800 text-sm truncate">{lesson.title}</h1>
            <span className="text-sm font-bold text-amber-600 shrink-0 mr-2">{currentIdx + 1}/{questions.length}</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label={`پیشرفت درس: ${Math.round(progress)} درصد`}
            className="h-2 bg-gray-200 rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      </div>

      {/* Quiz area */}
      <div className="flex-1 flex items-start justify-center p-5 pt-8 overflow-y-auto">
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
