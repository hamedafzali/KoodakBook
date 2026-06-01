'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import Mascot from '@/components/child/Mascot'
import { playComplete } from '@/lib/sounds'
import WordTile from '@/components/child/WordTile'
import LetterTile from '@/components/child/LetterTile'
import RewardPopup from '@/components/child/RewardPopup'
import type { Lesson, LessonItem, Badge, Child } from '@koodakbook/shared'

type LessonWithItems = Lesson & { items: LessonItem[] }

export default function LessonPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [lesson, setLesson] = useState<LessonWithItems | null>(null)
  const [childId, setChildId] = useState<string>('')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [newBadge, setNewBadge] = useState<Badge | null>(null)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [lessonRes, childRes] = await Promise.all([
        api.get<LessonWithItems>(`/api/lessons/${id}`),
        api.get<Child[]>('/api/children'),
      ])
      if (lessonRes.data) setLesson(lessonRes.data)
      if (childRes.data?.[0]) setChildId(childRes.data[0].id)
    }
    load()
  }, [id, router])

  async function handleItemInteraction(wordId: string) {
    if (!childId) return
    await api.post('/api/progress/word', { child_id: childId, word_id: wordId, status: 'practiced' })
  }

  async function handleComplete() {
    if (!childId || !lesson) return
    const res = await api.post<{ new_badges: Badge[] }>(
      '/api/progress/lesson',
      { child_id: childId, lesson_id: lesson.id, score: 100 }
    )
    if (res.data?.new_badges?.[0]) setNewBadge(res.data.new_badges[0])
    else setCompleted(true)
  }

  if (!lesson) return <div className="min-h-screen flex items-center justify-center text-gray-500">در حال بارگذاری...</div>

  const item = lesson.items[currentIdx]
  const isLast = currentIdx === lesson.items.length - 1

  if (completed) {
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#f97316','#eab308','#22c55e','#3b82f6'] })
    playComplete()
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 p-6 gap-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
          <Mascot size={130} mood="excited" />
        </motion.div>
        <motion.h1 className="text-3xl font-bold text-gray-800" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          آفرین! 🌟
        </motion.h1>
        <motion.p className="text-gray-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          درس «{lesson.title}» تموم شد
        </motion.p>
        <motion.button onClick={() => router.push('/child/home')}
          className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold py-4 px-10 rounded-2xl text-lg shadow-md"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
          برگشت به خانه 🏠
        </motion.button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col">
      {newBadge && <RewardPopup badge={newBadge} onClose={() => { setNewBadge(null); setCompleted(true) }} />}

      <div className="bg-white/80 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <motion.button onClick={() => router.back()} whileTap={{ scale: 0.85 }}
          className="text-gray-400 hover:text-gray-600 text-2xl">←</motion.button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-800">{lesson.title}</h1>
          <div className="h-2 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
              animate={{ width: `${((currentIdx + 1) / lesson.items.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 100 }} />
          </div>
        </div>
        <span className="text-sm font-bold text-amber-600">{currentIdx + 1}/{lesson.items.length}</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div key={currentIdx} className="w-full"
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
            {item?.word && (
              <WordTile word={item.word} size="lg" onClick={() => handleItemInteraction(item.word!.id)} />
            )}
            {item?.letter && <LetterTile letter={item.letter} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-6 flex gap-3">
        <motion.button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
          whileTap={{ scale: 0.93 }}
          className="flex-1 py-4 rounded-2xl border-2 border-gray-300 text-gray-500 font-bold disabled:opacity-30">
          ← قبلی
        </motion.button>
        <motion.button onClick={() => isLast ? handleComplete() : setCurrentIdx(i => i + 1)}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
          className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md">
          {isLast ? '✅ تموم!' : 'بعدی →'}
        </motion.button>
      </div>
    </div>
  )
}
