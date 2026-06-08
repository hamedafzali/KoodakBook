'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { mediaUrl } from '@/lib/media'
import { useChildSession } from '@/lib/useSession'
import { pickChild } from '@/lib/activeChild'
import Mascot from '@/components/child/Mascot'
import BottomNav from '@/components/child/BottomNav'
import EmptyState from '@/components/child/EmptyState'
import Tutorial, { hasSeenTutorial } from '@/components/child/Tutorial'
import { ACTIVITY_GRADIENTS, LESSON_TYPE_EMOJI, resolveLevel, wordEmoji } from '@koodakbook/shared'
import type { Lesson, Story, Child, DashboardSummary, ReviewItem } from '@koodakbook/shared'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'صبح بخیر'
  if (h < 17) return 'ظهر بخیر'
  return 'شب بخیر'
}

export default function ChildHomePage() {
  const router = useRouter()
  const [child, setChild] = useState<Child | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [stats, setStats] = useState({ words: 0, streak: 0, xp: 0 })
  const [reviewWords, setReviewWords] = useState<ReviewItem[]>([])
  const [lastLesson, setLastLesson] = useState<Lesson | null>(null)
  const [lastStory, setLastStory] = useState<Story | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)

  useChildSession(child?.id ?? null)

  useEffect(() => { if (!hasSeenTutorial()) setShowTutorial(true) }, [])

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [childRes, lessonsRes, storiesRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<Lesson[]>('/api/lessons'),
        api.get<Story[]>('/api/stories'),
      ])
      const c = pickChild(childRes.data ?? [])
      if (c) {
        setChild(c)
        const [dashRes, reviewRes, progressRes] = await Promise.all([
          api.get<DashboardSummary>(`/api/dashboard/${c.id}`),
          api.get<ReviewItem[]>(`/api/progress/${c.id}/review`),
          api.get<{ lessons: { lesson_id: string; completed: boolean }[]; stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${c.id}`),
        ])
        if (dashRes.data) setStats({ words: dashRes.data.words_learned, streak: dashRes.data.streak_days, xp: dashRes.data.xp ?? 0 })

        /* Spaced repetition: words the Leitner scheduler says are due now */
        if (reviewRes.data) setReviewWords(reviewRes.data)

        if (progressRes.data) {
          /* Last accessed lesson */
          const lastLessonId = progressRes.data.lessons
            .filter(l => !l.completed)
            .at(-1)?.lesson_id
          if (lastLessonId && lessonsRes.data) {
            setLastLesson(lessonsRes.data.find(l => l.id === lastLessonId) ?? null)
          }

          /* Last accessed story */
          const lastStoryId = progressRes.data.stories
            .filter(s => !s.completed)
            .at(-1)?.story_id
          if (lastStoryId && storiesRes.data) {
            setLastStory(storiesRes.data.find(s => s.id === lastStoryId) ?? null)
          }
        }
      }
      if (lessonsRes.data) setLessons(lessonsRes.data.slice(0, 4))
      if (storiesRes.data) setStories(storiesRes.data.slice(0, 4))
    }
    load()
  }, [router])

  return (
    <div className="min-h-screen child-bg pb-nav">

      <AnimatePresence>
        {showTutorial && (
          <Tutorial childName={child?.name} onClose={() => setShowTutorial(false)} />
        )}
      </AnimatePresence>

      {/* ── Hero ── */}
      <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 pt-10 pb-16 px-5 rounded-b-[3rem] overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" aria-hidden="true" />
        <div className="absolute top-4 -left-6 w-20 h-20 bg-white/10 rounded-full" aria-hidden="true" />

        <div className="relative flex items-end justify-between">
          <div className="text-white">
            <p className="text-white/90 text-sm mb-1">{greeting()} 👋</p>
            <h1 className="text-3xl font-bold leading-tight">
              {child?.name ?? 'کودک عزیز'}
            </h1>
            <div className="flex gap-2 mt-3 flex-wrap">
              {stats.streak > 0 && (
                <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1">
                  🔥 <span>{stats.streak} روز</span>
                </div>
              )}
              {stats.words > 0 && (
                <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1">
                  ⭐ <span>{stats.words} کلمه</span>
                </div>
              )}
              <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1">
                🎓 <span>{resolveLevel(stats.xp).label}</span>
              </div>
            </div>
          </div>
          <Mascot size={110} mood={stats.streak > 0 ? 'happy' : 'idle'} className="-mb-6" />
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6">

        {/* ── Continue where you left off ── */}
        {(lastLesson || lastStory) && (
          <section>
            <h2 className="font-bold text-gray-800 text-base mb-2">ادامه بده 🎯</h2>
            {lastLesson && (
              <Link href={`/child/lesson/${lastLesson.id}`}>
                <motion.div
                  className="bg-white rounded-[1.75rem] p-4 shadow-sm flex items-center gap-3"
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">
                    {LESSON_TYPE_EMOJI[lastLesson.type] ?? '📖'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-600 font-medium">درس ناتمام</p>
                    <p className="font-bold text-gray-800 truncate">{lastLesson.title}</p>
                  </div>
                  <span className="text-amber-400 text-xl">←</span>
                </motion.div>
              </Link>
            )}
            {lastStory && !lastLesson && (
              <Link href={`/child/story/${lastStory.id}`}>
                <motion.div
                  className="bg-white rounded-[1.75rem] p-4 shadow-sm flex items-center gap-3"
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">📖</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-600 font-medium">داستان ناتمام</p>
                    <p className="font-bold text-gray-800 truncate">{lastStory.title_persian}</p>
                  </div>
                  <span className="text-green-400 text-xl">←</span>
                </motion.div>
              </Link>
            )}
          </section>
        )}

        {/* ── Spaced-repetition review ── */}
        {reviewWords.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-800 text-base">مرور امروز 🔄</h2>
              <Link href="/child/review" className="text-amber-700 text-sm font-medium hover:underline">شروع ←</Link>
            </div>
            <Link href="/child/review" aria-label={`مرور ${reviewWords.length} کلمه`}>
              <motion.div className="bg-white rounded-[1.75rem] p-3 shadow-sm" whileTap={{ scale: 0.98 }}>
                <div className="flex gap-2 overflow-x-auto pb-1 snap-x" role="list" aria-label="کلمات برای مرور">
                  {reviewWords.slice(0, 8).map(({ word }) => (
                    <div
                      key={word.id}
                      role="listitem"
                      className="flex-shrink-0 snap-start bg-amber-50 rounded-[1.25rem] px-4 py-3 flex flex-col items-center gap-1 min-w-[80px]"
                    >
                      {mediaUrl(word.image_url) ? (
                        <img src={mediaUrl(word.image_url)!} alt={word.english} className="w-10 h-10 object-contain" />
                      ) : (
                        <span className="text-3xl" aria-hidden="true">{wordEmoji(word.english) ?? '🔤'}</span>
                      )}
                      <span className="font-bold text-gray-800 text-lg">{word.persian}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-amber-600 font-medium mt-2">
                  {reviewWords.length} کلمه برای مرور — ضربه بزن 🎯
                </p>
              </motion.div>
            </Link>
          </section>
        )}

        {/* ── Lessons ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-base">درس‌های امروز 📚</h2>
            <Link href="/child/lesson" className="text-amber-700 text-sm font-medium hover:underline">
              همه ←
            </Link>
          </div>
          {lessons.length === 0 ? (
            <EmptyState message="هنوز درسی نیست" subMessage="به زودی اضافه می‌شود!" />
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
              {lessons.map((lesson, idx) => (
                <motion.div key={lesson.id} variants={item}>
                  <Link href={`/child/lesson/${lesson.id}`}>
                    <motion.div
                      className={`bg-gradient-to-br ${ACTIVITY_GRADIENTS[idx % ACTIVITY_GRADIENTS.length]} rounded-[1.75rem] p-4 text-white shadow-md`}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    >
                      <span className="text-3xl" aria-hidden="true">{LESSON_TYPE_EMOJI[lesson.type] ?? '📖'}</span>
                      <p className="font-bold mt-2 text-sm leading-tight">{lesson.title}</p>
                      <p className="text-xs opacity-80 mt-0.5">مرحله {lesson.stage}</p>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>

        {/* ── Stories ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-base">داستان‌ها 📖</h2>
            <Link href="/child/story" className="text-amber-700 text-sm font-medium hover:underline">
              همه ←
            </Link>
          </div>
          {stories.length === 0 ? (
            <EmptyState message="هنوز داستانی نیست" />
          ) : (
            <div
              className="flex gap-3 overflow-x-auto pb-2 snap-x"
              role="list"
              aria-label="داستان‌ها"
            >
              {stories.map((story, idx) => (
                <Link
                  key={story.id}
                  href={`/child/story/${story.id}`}
                  role="listitem"
                  className="flex-shrink-0 snap-start"
                  aria-label={story.title_persian}
                >
                  <motion.div
                    className="w-36 bg-white rounded-[1.75rem] overflow-hidden shadow-md"
                    whileHover={{ scale: 1.04, y: -3 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  >
                    {mediaUrl(story.cover_url) ? (
                      <img
                        src={mediaUrl(story.cover_url)!}
                        alt={story.title_persian}
                        className="w-full h-28 object-cover"
                      />
                    ) : (
                      <div className={`w-full h-28 bg-gradient-to-br ${ACTIVITY_GRADIENTS[idx % ACTIVITY_GRADIENTS.length]} flex items-center justify-center text-5xl`} aria-hidden="true">
                        📖
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-bold text-gray-800 text-sm leading-tight">{story.title_persian}</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Practice ── */}
        <section>
          <h2 className="font-bold text-gray-800 text-base mb-3">تمرین کن 🌟</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/child/write" aria-label="تمرین نوشتن">
              <motion.div
                className="bg-gradient-to-br from-blue-400 to-cyan-500 rounded-[1.75rem] p-4 shadow-sm flex items-center gap-3 min-h-[72px] text-white"
                whileTap={{ scale: 0.96 }}
              >
                <span className="text-3xl" aria-hidden="true">✏️</span>
                <div>
                  <p className="font-bold text-sm">نوشتن</p>
                  <p className="text-xs opacity-80">حرف‌ها را بنویس</p>
                </div>
              </motion.div>
            </Link>
            <Link href="/child/speak" aria-label="تمرین گفتن">
              <motion.div
                className="bg-gradient-to-br from-rose-400 to-pink-500 rounded-[1.75rem] p-4 shadow-sm flex items-center gap-3 min-h-[72px] text-white"
                whileTap={{ scale: 0.96 }}
              >
                <span className="text-3xl" aria-hidden="true">🎤</span>
                <div>
                  <p className="font-bold text-sm">گفتن</p>
                  <p className="text-xs opacity-80">کلمه‌ها را بگو</p>
                </div>
              </motion.div>
            </Link>
            <Link href="/child/rewards" aria-label="جوایز من">
              <motion.div
                className="bg-white rounded-[1.75rem] p-4 shadow-sm flex items-center gap-3 min-h-[72px]"
                whileTap={{ scale: 0.96 }}
              >
                <span className="text-3xl" aria-hidden="true">🏆</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">جوایز من</p>
                  <p className="text-xs text-gray-400">مدال‌هایم</p>
                </div>
              </motion.div>
            </Link>
            <Link href="/parent/dashboard" aria-label="داشبورد والدین">
              <motion.div
                className="bg-white rounded-[1.75rem] p-4 shadow-sm flex items-center gap-3 min-h-[72px]"
                whileTap={{ scale: 0.96 }}
              >
                <span className="text-3xl" aria-hidden="true">👨‍👩‍👧</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">بابا مامان</p>
                  <p className="text-xs text-gray-400">داشبورد</p>
                </div>
              </motion.div>
            </Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  )
}
