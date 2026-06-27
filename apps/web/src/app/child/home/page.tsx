'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { mediaUrl } from '@/lib/media'
import { useChildSession } from '@/lib/useSession'
import { pickChild, setActiveChildId } from '@/lib/activeChild'
import { consumeChildPick } from '@/lib/mode'
import Mascot from '@/components/child/Mascot'
import BottomNav from '@/components/child/BottomNav'
import EmptyState from '@/components/child/EmptyState'
import Tutorial, { hasSeenTutorial } from '@/components/child/Tutorial'
import { ACTIVITY_GRADIENTS, LESSON_TYPE_EMOJI, resolveLevel, wordEmoji, isLessonUnlocked, isStoryUnlocked, ALL_UNLOCKED } from '@koodakbook/shared'
import type { Lesson, Story, Child, DashboardSummary, ReviewItem, StrandLevels } from '@koodakbook/shared'

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
  const [strandLevels, setStrandLevels] = useState<StrandLevels>(ALL_UNLOCKED)
  const [lastLesson, setLastLesson] = useState<Lesson | null>(null)
  const [lastStory, setLastStory] = useState<Story | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [pickList, setPickList] = useState<Child[]>([])   // "who's playing?" — only when a parent switches in with >1 child
  const [showPicker, setShowPicker] = useState(false)

  useChildSession(child?.id ?? null)

  useEffect(() => { if (!hasSeenTutorial()) setShowTutorial(true) }, [])

  // Load everything for one chosen child (runs after the child is resolved).
  async function loadForChild(c: Child) {
    setChild(c)
    const [lessonsRes, storiesRes, dashRes, reviewRes, progressRes, placeRes] = await Promise.all([
      api.get<Lesson[]>('/api/lessons'),
      api.get<Story[]>('/api/stories'),
      api.get<DashboardSummary>(`/api/dashboard/${c.id}`),
      api.get<ReviewItem[]>(`/api/progress/${c.id}/review`),
      api.get<{ lessons: { lesson_id: string; completed: boolean }[]; stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${c.id}`),
      api.get<{ strand_levels: StrandLevels }>(`/api/placement/${c.id}`),
    ])
    if (dashRes.data) setStats({ words: dashRes.data.words_learned, streak: dashRes.data.streak_days, xp: dashRes.data.xp ?? 0 })
    if (placeRes.data?.strand_levels) setStrandLevels(placeRes.data.strand_levels)
    if (reviewRes.data) setReviewWords(reviewRes.data)   // spaced-repetition words due now
    if (progressRes.data) {
      const lastLessonId = progressRes.data.lessons.filter(l => !l.completed).at(-1)?.lesson_id
      if (lastLessonId && lessonsRes.data) setLastLesson(lessonsRes.data.find(l => l.id === lastLessonId) ?? null)
      const lastStoryId = progressRes.data.stories.filter(s => !s.completed).at(-1)?.story_id
      if (lastStoryId && storiesRes.data) setLastStory(storiesRes.data.find(s => s.id === lastStoryId) ?? null)
    }
    if (lessonsRes.data) setLessons(lessonsRes.data)
    if (storiesRes.data) setStories(storiesRes.data)
  }

  // Resolve a chosen child: remember it, run the placement assessment the first
  // time (deferred from creation), otherwise load the home.
  function resolveChild(c: Child) {
    setActiveChildId(c.id)
    if (!c.placement_done) { router.replace('/onboarding/placement'); return }
    setShowPicker(false)
    loadForChild(c)
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    let cancelled = false
    async function start() {
      const childRes = await api.get<Child[]>('/api/children')
      if (cancelled) return
      const list = childRes.data ?? []
      if (list.length === 0) { router.replace('/parent/dashboard'); return }
      // Parent just switched in and there are several kids → ask who's playing.
      if (consumeChildPick() && list.length > 1) { setPickList(list); setShowPicker(true); return }
      const c = pickChild(list)
      if (c) resolveChild(c)
    }
    start()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Order by placement: unlocked first, then by stage; show the top few.
  const lessonView = [...lessons]
    .map(l => ({ l, locked: !isLessonUnlocked(l, strandLevels) }))
    .sort((a, b) => Number(a.locked) - Number(b.locked) || a.l.stage - b.l.stage)
    .slice(0, 4)
  const storyView = [...stories]
    .map(s => ({ s, locked: !isStoryUnlocked(s, strandLevels) }))
    .sort((a, b) => Number(a.locked) - Number(b.locked) || a.s.stage - b.s.stage)
    .slice(0, 4)

  // "Who's playing?" — shown when a parent switches into child mode with >1 child.
  if (showPicker) {
    return (
      <div className="min-h-screen child-bg flex flex-col items-center justify-center p-6 gap-8">
        <h1 className="text-2xl font-bold text-gray-800 persian-text">کی می‌خواد بازی کنه؟ 🎮</h1>
        <div className="grid grid-cols-2 gap-5 w-full max-w-md">
          {pickList.map(c => (
            <motion.button
              key={c.id}
              onClick={() => resolveChild(c)}
              whileTap={{ scale: 0.94 }}
              className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center gap-3"
              aria-label={`بازی با ${c.name}`}
            >
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden text-4xl">
                {mediaUrl(c.avatar_url) ? (
                  <img src={mediaUrl(c.avatar_url)!} alt="" className="w-full h-full object-cover" />
                ) : '🧒'}
              </div>
              <span className="font-bold text-gray-800">{c.name}</span>
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen child-bg pb-nav">

      <AnimatePresence>
        {showTutorial && (
          <Tutorial childName={child?.name} onClose={() => setShowTutorial(false)} />
        )}
      </AnimatePresence>

      {/* ── Hero ── */}
      <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 pt-10 pb-16 px-5 rounded-b-[3rem] overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" aria-hidden="true" />
        <div className="absolute top-4 -left-6 w-20 h-20 bg-white/10 rounded-full" aria-hidden="true" />

        <div className="relative flex items-end justify-between">
          <div className="text-white">
            <p className="text-white text-sm mb-1">{greeting()} 👋</p>
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

      <div className="px-4 lg:px-8 pt-5 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">

        {/* ── Left column: companion + continue + review ── */}
        <div className="space-y-6 lg:col-span-4">

        {/* Desktop companion (lg-only) — anchors the left column even before a
            child has any progress, so the two-column home never looks lopsided. */}
        <aside className="hidden lg:block bg-white rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Mascot size={56} mood={stats.streak > 0 ? 'happy' : 'idle'} />
            <div className="min-w-0">
              <p className="font-bold text-gray-800 truncate">{child?.name ?? 'کودک عزیز'}</p>
              <p className="text-sm text-amber-600 font-medium">{resolveLevel(stats.xp).label}</p>
            </div>
          </div>
          <div
            className="mt-4 h-2.5 bg-amber-100 rounded-full overflow-hidden"
            role="progressbar" aria-valuenow={resolveLevel(stats.xp).pct} aria-valuemin={0} aria-valuemax={100}
            aria-label="پیشرفت سطح"
          >
            <div className="h-full bg-brand-gradient rounded-full" style={{ width: `${resolveLevel(stats.xp).pct}%` }} />
          </div>
          <div className="flex gap-3 mt-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">🔥 {stats.streak} روز</span>
            <span className="flex items-center gap-1">⭐ {stats.words} کلمه</span>
          </div>
        </aside>

        {/* ── Continue where you left off ── */}
        {(lastLesson || lastStory) && (
          <section>
            <h2 className="font-bold text-gray-800 text-base mb-2">ادامه بده 🎯</h2>
            {lastLesson && (
              <Link href={`/child/lesson/${lastLesson.id}`}>
                <motion.div
                  className="bg-white rounded-lg p-4 shadow-sm flex items-center gap-3"
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
                  className="bg-white rounded-lg p-4 shadow-sm flex items-center gap-3"
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
              <motion.div className="bg-white rounded-lg p-3 shadow-sm" whileTap={{ scale: 0.98 }}>
                <div className="flex gap-2 overflow-x-auto pb-1 snap-x" role="list" aria-label="کلمات برای مرور">
                  {reviewWords.slice(0, 8).map(({ word }) => (
                    <div
                      key={word.id}
                      role="listitem"
                      className="flex-shrink-0 snap-start bg-amber-50 rounded-md px-4 py-3 flex flex-col items-center gap-1 min-w-[80px]"
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

        </div>{/* ── left column end ── */}

        {/* ── Right column: lessons / stories / practice ── */}
        <div className="space-y-6 mt-6 lg:mt-0 lg:col-span-8">

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
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {lessonView.map(({ l: lesson, locked }, idx) => (
                <motion.div key={lesson.id} variants={item}>
                  {locked ? (
                    <div
                      className="rounded-lg p-4 bg-white/60 shadow-sm cursor-not-allowed select-none"
                      aria-label={`${lesson.title} — قفل شده، به زودی`}
                    >
                      <span className="text-3xl" aria-hidden="true">🔒</span>
                      <p className="font-bold mt-2 text-sm leading-tight text-gray-500">{lesson.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">به زودی</p>
                    </div>
                  ) : (
                    <Link href={`/child/lesson/${lesson.id}`}>
                      <motion.div
                        className={`bg-gradient-to-br ${ACTIVITY_GRADIENTS[idx % ACTIVITY_GRADIENTS.length]} rounded-lg p-4 text-white shadow-md`}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      >
                        <span className="text-3xl" aria-hidden="true">{LESSON_TYPE_EMOJI[lesson.type] ?? '📖'}</span>
                        <p className="font-bold mt-2 text-sm leading-tight">{lesson.title}</p>
                        <p className="text-xs opacity-80 mt-0.5">مرحله {lesson.stage}</p>
                      </motion.div>
                    </Link>
                  )}
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
              {storyView.map(({ s: story, locked }, idx) => (
                locked ? (
                  <div
                    key={story.id}
                    role="listitem"
                    className="flex-shrink-0"
                    aria-label={`${story.title_persian} — قفل شده، به زودی`}
                  >
                    <div className="w-36 bg-white/60 rounded-lg overflow-hidden shadow-sm cursor-not-allowed select-none">
                      <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-5xl" aria-hidden="true">🔒</div>
                      <div className="p-3">
                        <p className="font-bold text-gray-400 text-sm leading-tight">{story.title_persian}</p>
                        <p className="text-xs text-gray-400 mt-0.5">به زودی</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={story.id}
                    href={`/child/story/${story.id}`}
                    role="listitem"
                    className="flex-shrink-0 snap-start"
                    aria-label={story.title_persian}
                  >
                    <motion.div
                      className="w-36 bg-white rounded-lg overflow-hidden shadow-md"
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
                )
              ))}
            </div>
          )}
        </section>

        {/* ── Practice ── */}
        <section>
          <h2 className="font-bold text-gray-800 text-base mb-3">تمرین کن 🌟</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/child/phonics" aria-label="صداها: زبر زیر پیش">
              <motion.div
                className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg p-4 shadow-sm flex items-center gap-3 min-h-[72px] text-white"
                whileTap={{ scale: 0.96 }}
              >
                <span className="text-3xl" aria-hidden="true">🎵</span>
                <div>
                  <p className="font-bold text-sm">صداها</p>
                  <p className="text-xs opacity-90">زبر، زیر، پیش</p>
                </div>
              </motion.div>
            </Link>
            <Link href="/child/write" aria-label="تمرین نوشتن">
              <motion.div
                className="bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg p-4 shadow-sm flex items-center gap-3 min-h-[72px] text-white"
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
                className="bg-gradient-to-br from-rose-400 to-pink-500 rounded-lg p-4 shadow-sm flex items-center gap-3 min-h-[72px] text-white"
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
                className="bg-white rounded-lg p-4 shadow-sm flex items-center gap-3 min-h-[72px]"
                whileTap={{ scale: 0.96 }}
              >
                <span className="text-3xl" aria-hidden="true">🏆</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">جوایز من</p>
                  <p className="text-xs text-gray-500">مدال‌هایم</p>
                </div>
              </motion.div>
            </Link>
          </div>
        </section>
        </div>{/* ── right column end ── */}
      </div>{/* ── two-column grid end ── */}

      <BottomNav />
    </div>
  )
}
