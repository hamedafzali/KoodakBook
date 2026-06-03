'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { mediaUrl } from '@/lib/media'
import BottomNav from '@/components/child/BottomNav'
import PageHeader from '@/components/child/PageHeader'
import LoadingScreen from '@/components/child/LoadingScreen'
import EmptyState from '@/components/child/EmptyState'
import { ACTIVITY_GRADIENTS } from '@koodakbook/shared'
import type { Story, Child } from '@koodakbook/shared'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1 } }

export default function StoryListPage() {
  const router = useRouter()
  const [stories, setStories] = useState<Story[]>([])
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [storiesRes, childRes] = await Promise.all([
        api.get<Story[]>('/api/stories'),
        api.get<Child[]>('/api/children'),
      ])
      if (storiesRes.data) setStories(storiesRes.data)
      if (childRes.data?.[0]) {
        const progRes = await api.get<{ stories: { story_id: string; completed: boolean }[] }>(
          `/api/progress/${childRes.data[0].id}`
        )
        if (progRes.data) {
          setCompleted(new Set(progRes.data.stories.filter(s => s.completed).map(s => s.story_id)))
        }
      }
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingScreen message="در حال بارگذاری داستان‌ها..." />

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader
        title="همه داستان‌ها 📖"
        subtitle={`${stories.length} داستان موجود است`}
        gradientClass="from-green-400 to-emerald-500"
      />

      <div className="px-4 pt-5">
        {stories.length === 0 ? (
          <EmptyState
            message="هنوز داستانی نیست"
            subMessage="به زودی داستان‌های جدید اضافه می‌شود!"
          />
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-4"
            role="list"
            aria-label="لیست داستان‌ها"
          >
            {stories.map((story, idx) => {
              const done = completed.has(story.id)
              return (
                <motion.div key={story.id} variants={item} role="listitem">
                  <Link
                    href={`/child/story/${story.id}`}
                    aria-label={`${story.title_persian}${done ? ' — خوانده شده' : ''}${story.age_min ? `، برای ${story.age_min} تا ${story.age_max} سال` : ''}`}
                    className="block bg-white rounded-[1.75rem] shadow-sm hover:shadow-md transition-shadow overflow-hidden relative"
                  >
                    {done && (
                      <div
                        className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full z-10 font-medium"
                        aria-hidden="true"
                      >
                        ✅ خوندم
                      </div>
                    )}
                    {mediaUrl(story.cover_url) ? (
                      <img
                        src={mediaUrl(story.cover_url)!}
                        alt={story.title_persian}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div
                        className={`w-full h-32 bg-gradient-to-br ${ACTIVITY_GRADIENTS[idx % ACTIVITY_GRADIENTS.length]} flex items-center justify-center text-5xl`}
                        aria-hidden="true"
                      >
                        📖
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-bold text-gray-800 text-sm leading-tight persian-text">{story.title_persian}</p>
                      {story.age_min && (
                        <p className="text-xs text-gray-400 mt-1">
                          {story.age_min}–{story.age_max} سال
                        </p>
                      )}
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
