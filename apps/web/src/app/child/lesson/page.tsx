'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import BottomNav from '@/components/child/BottomNav'
import PageHeader from '@/components/child/PageHeader'
import LoadingScreen from '@/components/child/LoadingScreen'
import EmptyState from '@/components/child/EmptyState'
import { LESSON_TYPE_EMOJI, LESSON_TYPE_LABEL, isLessonUnlocked, ALL_UNLOCKED } from '@koodakbook/shared'
import { pickChild } from '@/lib/activeChild'
import type { Lesson, Child, StrandLevels } from '@koodakbook/shared'

export default function LessonListPage() {
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progress, setProgress] = useState<Record<string, boolean>>({})
  const [strandLevels, setStrandLevels] = useState<StrandLevels>(ALL_UNLOCKED)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [lessonsRes, childRes] = await Promise.all([
        api.get<Lesson[]>('/api/lessons'),
        api.get<Child[]>('/api/children'),
      ])
      if (lessonsRes.data) setLessons(lessonsRes.data)
      const child = pickChild(childRes.data ?? [])
      if (child) {
        const [progRes, placeRes] = await Promise.all([
          api.get<{ lessons: { lesson_id: string; completed: boolean }[] }>(`/api/progress/${child.id}`),
          api.get<{ strand_levels: StrandLevels }>(`/api/placement/${child.id}`),
        ])
        if (progRes.data) {
          const map: Record<string, boolean> = {}
          progRes.data.lessons.forEach(l => { map[l.lesson_id] = l.completed })
          setProgress(map)
        }
        if (placeRes.data?.strand_levels) setStrandLevels(placeRes.data.strand_levels)
      }
      setLoading(false)
    }
    load()
  }, [router])

  const grouped = lessons.reduce<Record<string, Lesson[]>>((acc, l) => {
    acc[l.type] = [...(acc[l.type] ?? []), l]
    return acc
  }, {})

  if (loading) return <LoadingScreen message="در حال بارگذاری درس‌ها..." />

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader
        title="همه درس‌ها 📚"
        subtitle={`${lessons.length} درس موجود است`}
        gradientClass="from-amber-400 to-orange-500"
      />

      <div className="px-4 pt-5 space-y-6">
        {Object.keys(grouped).length === 0 && (
          <EmptyState
            message="هنوز درسی اضافه نشده"
            subMessage="به زودی درس‌های جدید اضافه می‌شود!"
          />
        )}

        {Object.entries(grouped).map(([type, items]) => (
          <section key={type} aria-labelledby={`section-${type}`}>
            <h2 id={`section-${type}`} className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-base">
              <span aria-hidden="true" className="text-xl">{LESSON_TYPE_EMOJI[type]}</span>
              {LESSON_TYPE_LABEL[type] ?? type}
            </h2>
            <div className="space-y-2" role="list" aria-label={`درس‌های ${LESSON_TYPE_LABEL[type] ?? type}`}>
              {items.map(lesson => {
                const done = progress[lesson.id]
                const locked = !isLessonUnlocked(lesson, strandLevels)
                return (
                  <motion.div
                    key={lesson.id}
                    role="listitem"
                    whileTap={locked ? {} : { scale: 0.98 }}
                  >
                    {locked ? (
                      <div
                        className="flex items-center gap-4 bg-white/50 rounded-md p-4 opacity-60 cursor-not-allowed"
                        aria-label={`${lesson.title} — قفل شده، مرحله ${lesson.stage} لازم است`}
                      >
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 bg-gray-100">
                          🔒
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-500">{lesson.title}</p>
                          <p className="text-xs text-gray-500">مرحله {lesson.stage} لازم است</p>
                        </div>
                      </div>
                    ) : (
                      <Link
                        href={`/child/lesson/${lesson.id}`}
                        aria-label={`${lesson.title}${done ? ' — تمام شده' : ''}`}
                        className="flex items-center gap-4 bg-white rounded-md p-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${done ? 'bg-green-100' : 'bg-amber-100'}`}>
                          {done ? '✅' : LESSON_TYPE_EMOJI[lesson.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800">{lesson.title}</p>
                          {lesson.description && (
                            <p className="text-sm text-gray-500 truncate mt-0.5">{lesson.description}</p>
                          )}
                        </div>
                        <svg
                          aria-hidden="true"
                          className="w-5 h-5 text-gray-300 flex-shrink-0"
                          fill="none" stroke="currentColor" strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </Link>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
