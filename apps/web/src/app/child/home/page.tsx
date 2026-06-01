'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { mediaUrl } from '@/lib/media'
import { useChildSession } from '@/lib/useSession'
import Mascot from '@/components/child/Mascot'
import type { Lesson, Story, Child, DashboardSummary } from '@koodakbook/shared'

const LESSON_COLORS = [
  'from-red-400 to-orange-400',
  'from-blue-400 to-cyan-400',
  'from-green-400 to-emerald-400',
  'from-purple-400 to-pink-400',
  'from-yellow-400 to-amber-400',
]

const LESSON_EMOJIS: Record<string, string> = { vocabulary: '📚', alphabet: '🔤', phonics: '🎵' }

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function ChildHomePage() {
  const router = useRouter()
  const [child, setChild] = useState<Child | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [stats, setStats] = useState({ words: 0, streak: 0 })

  useChildSession(child?.id ?? null)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [childRes, lessonsRes, storiesRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<Lesson[]>('/api/lessons'),
        api.get<Story[]>('/api/stories'),
      ])
      const c = childRes.data?.[0]
      if (c) {
        setChild(c)
        const dash = await api.get<DashboardSummary>(`/api/dashboard/${c.id}`)
        if (dash.data) setStats({ words: dash.data.words_learned, streak: dash.data.streak_days })
      }
      if (lessonsRes.data) setLessons(lessonsRes.data.slice(0, 4))
      if (storiesRes.data) setStories(storiesRes.data.slice(0, 4))
    }
    load()
  }, [router])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'صبح بخیر'
    if (h < 17) return 'ظهر بخیر'
    return 'شب بخیر'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-24">

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 pt-10 pb-16 px-6 rounded-b-[3rem] overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute top-4 -left-6 w-20 h-20 bg-white/10 rounded-full" />

        <div className="relative flex items-end justify-between">
          <div className="text-white">
            <p className="text-amber-100 text-sm mb-1">{greeting()} 👋</p>
            <h1 className="text-3xl font-bold leading-tight">
              {child?.name ?? 'کودک عزیز'}
            </h1>
            <div className="flex gap-3 mt-3">
              {stats.streak > 0 && (
                <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1">
                  🔥 {stats.streak} روز
                </div>
              )}
              {stats.words > 0 && (
                <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1">
                  ⭐ {stats.words} کلمه
                </div>
              )}
            </div>
          </div>
          <Mascot size={110} mood={stats.streak > 0 ? 'happy' : 'idle'} className="-mb-6" />
        </div>
      </div>

      <div className="px-4 pt-6 space-y-7">

        {/* Lessons */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-lg">درس‌های امروز 📚</h2>
            <Link href="/child/lesson" className="text-amber-600 text-sm font-medium">همه ←</Link>
          </div>
          <motion.div variants={container} initial="hidden" animate="show"
            className="grid grid-cols-2 gap-3">
            {lessons.map((lesson, idx) => (
              <motion.div key={lesson.id} variants={item}>
                <Link href={`/child/lesson/${lesson.id}`}>
                  <motion.div
                    className={`bg-gradient-to-br ${LESSON_COLORS[idx % LESSON_COLORS.length]} rounded-3xl p-4 text-white shadow-md`}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  >
                    <span className="text-3xl">{LESSON_EMOJIS[lesson.type] ?? '📖'}</span>
                    <p className="font-bold mt-2 text-sm leading-tight">{lesson.title}</p>
                    <p className="text-xs opacity-80 mt-0.5">مرحله {lesson.stage}</p>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Stories */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-lg">داستان‌ها 📖</h2>
            <Link href="/child/story" className="text-amber-600 text-sm font-medium">همه ←</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {stories.map((story, idx) => (
              <Link key={story.id} href={`/child/story/${story.id}`} className="flex-shrink-0 snap-start">
                <motion.div
                  className="w-36 bg-white rounded-3xl overflow-hidden shadow-md"
                  whileHover={{ scale: 1.04, y: -3 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  {mediaUrl(story.cover_url)
                    ? <img src={mediaUrl(story.cover_url)!} alt={story.title_english} className="w-full h-28 object-cover" />
                    : (
                      <div className={`w-full h-28 bg-gradient-to-br ${LESSON_COLORS[idx % LESSON_COLORS.length]} flex items-center justify-center text-5xl`}>
                        📖
                      </div>
                    )
                  }
                  <div className="p-3">
                    <p className="font-bold text-gray-800 text-sm leading-tight">{story.title_persian}</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="font-bold text-gray-800 text-lg mb-3">بیشتر 🌟</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/child/rewards">
              <motion.div
                className="bg-white rounded-3xl p-4 shadow-sm flex items-center gap-3"
                whileTap={{ scale: 0.96 }}
              >
                <span className="text-3xl">🏆</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">جوایز من</p>
                  <p className="text-xs text-gray-400">مدال‌هایم</p>
                </div>
              </motion.div>
            </Link>
            <Link href="/parent/dashboard">
              <motion.div
                className="bg-white rounded-3xl p-4 shadow-sm flex items-center gap-3"
                whileTap={{ scale: 0.96 }}
              >
                <span className="text-3xl">👨‍👩‍👧</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">بابا مامان</p>
                  <p className="text-xs text-gray-400">داشبورد</p>
                </div>
              </motion.div>
            </Link>
          </div>
        </section>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-100 flex justify-around py-3 px-4">
        {[
          { href: '/child/home',    emoji: '🏠', label: 'خانه',    active: true },
          { href: '/child/lesson',  emoji: '📚', label: 'درس‌ها',  active: false },
          { href: '/child/story',   emoji: '📖', label: 'داستان',  active: false },
          { href: '/child/rewards', emoji: '🏆', label: 'جوایز',   active: false },
        ].map(nav => (
          <Link key={nav.href} href={nav.href}
            className={`flex flex-col items-center gap-1 ${nav.active ? 'text-amber-600' : 'text-gray-400'}`}>
            <motion.span className="text-2xl" whileTap={{ scale: 0.8 }}>{nav.emoji}</motion.span>
            <span className={`text-xs ${nav.active ? 'font-bold' : ''}`}>{nav.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
