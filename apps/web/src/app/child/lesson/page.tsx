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
import ErrorState from '@/components/child/ErrorState'
import { LESSON_TYPE_EMOJI, LESSON_TYPE_LABEL, isLessonUnlocked, ALL_UNLOCKED, toPersianDigits } from '@koodakbook/shared'
import { pickChild } from '@/lib/activeChild'
import { softClayVars } from '@/components/child/clay'
import type { Lesson, Child, StrandLevels } from '@koodakbook/shared'

export default function LessonListPage() {
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progress, setProgress] = useState<Record<string, boolean>>({})
  const [strandLevels, setStrandLevels] = useState<StrandLevels>(ALL_UNLOCKED)
  const [loading, setLoading] = useState(true)
  // A failed catalogue fetch used to fall through to «هنوز درسی اضافه نشده»
  // — an error shown as an empty catalogue. Empty and failed are different.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    let cancelled = false
    async function load() {
      const [lessonsRes, childRes] = await Promise.all([
        api.get<Lesson[]>('/api/lessons'),
        api.get<Child[]>('/api/children'),
      ])
      if (cancelled) return
      if (!lessonsRes.data) { setLoadError(lessonsRes.error ?? 'اتصال برقرار نشد. دوباره تلاش کن'); setLoading(false); return }
      setLessons(lessonsRes.data)
      const child = pickChild(childRes.data ?? [])
      if (child) {
        const [progRes, placeRes] = await Promise.all([
          api.get<{ lessons: { lesson_id: string; completed: boolean }[] }>(`/api/progress/${child.id}`),
          api.get<{ strand_levels: StrandLevels }>(`/api/placement/${child.id}`),
        ])
        if (cancelled) return
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
    return () => { cancelled = true }
  }, [router, attempt])

  const grouped = lessons.reduce<Record<string, Lesson[]>>((acc, l) => {
    acc[l.type] = [...(acc[l.type] ?? []), l]
    return acc
  }, {})

  if (loading) return <LoadingScreen message="در حال بارگذاری درس‌ها..." />
  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => { setLoadError(null); setLoading(true); setAttempt(a => a + 1) }} />
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader
        title="همه درس‌ها"
        subtitle={`${toPersianDigits(lessons.length)} درس موجود است`}
        module="lessons"
      />

      <div className="px-4 lg:px-8 pt-5 space-y-6">
        {Object.keys(grouped).length === 0 && (
          <EmptyState
            message="هنوز درسی اضافه نشده"
            subMessage="به زودی درس‌های جدید اضافه می‌شود!"
          />
        )}

        {Object.entries(grouped).map(([type, items]) => (
          <section key={type} aria-labelledby={`section-${type}`}>
            <h2 id={`section-${type}`} className="font-display font-black text-card-title text-text-primary mb-3 flex items-center gap-2">
              <span aria-hidden="true" className="text-xl">{LESSON_TYPE_EMOJI[type]}</span>
              {LESSON_TYPE_LABEL[type] ?? type}
            </h2>
            <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3" role="list" aria-label={`درس‌های ${LESSON_TYPE_LABEL[type] ?? type}`}>
              {items.map(lesson => {
                const done = progress[lesson.id]
                const locked = !isLessonUnlocked(lesson, strandLevels)
                return (
                  <motion.div
                    key={lesson.id}
                    role="listitem"
                    whileTap={locked ? {} : { scale: 0.98 }}
                    tabIndex={-1} /* the Link inside is the tab stop, not this wrapper */
                  >
                    {locked ? (
                      /* The lock used to live only in an aria-label on this
                         plain <div>, which screen readers don't announce
                         (generic role) — the padlock was aria-hidden, so the
                         locked state went unheard. The padlock now carries it. */
                      <div
                        className="flex items-center gap-4 bg-surface-subtle rounded-2xl p-4 opacity-70 cursor-not-allowed"
                        aria-disabled="true"
                      >
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 bg-surface-subtle">
                          <span role="img" aria-label="قفل شده">🔒</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-text-secondary">{lesson.title}</p>
                          <p className="text-xs text-text-secondary">مرحله {toPersianDigits(lesson.stage)} لازم است</p>
                        </div>
                      </div>
                    ) : (
                      <Link
                        href={`/child/lesson/${lesson.id}`}
                        aria-label={`${lesson.title}${done ? ' — تمام شده' : ''}`}
                        /* The clay container (white face, lessons edge) —
                           the same material as Home's cards, not a one-off
                           white card. */
                        className="clay-static flex items-center gap-4 p-4"
                        style={softClayVars('lessons')}
                      >
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${done ? 'bg-lessons-soft' : 'bg-brand-soft'}`}>
                          <span aria-hidden="true">{done ? '✅' : LESSON_TYPE_EMOJI[lesson.type]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-text-primary">{lesson.title}</p>
                          {lesson.description && (
                            <p className="text-sm text-text-secondary truncate mt-0.5">{lesson.description}</p>
                          )}
                        </div>
                        <svg
                          aria-hidden="true"
                          className="w-5 h-5 text-text-secondary flex-shrink-0"
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
