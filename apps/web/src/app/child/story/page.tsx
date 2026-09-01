'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { mediaUrl } from '@/lib/media'
import BottomNav from '@/components/child/BottomNav'
import PageHeader from '@/components/child/PageHeader'
import LoadingScreen from '@/components/child/LoadingScreen'
import EmptyState from '@/components/child/EmptyState'
import { pickChild } from '@/lib/activeChild'
import { ACTIVITY_GRADIENTS } from '@koodakbook/shared'
import type { Story, Child } from '@koodakbook/shared'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1 } }

export default function StoryListPage() {
  const router = useRouter()
  const [stories, setStories] = useState<Story[]>([])
  const [myStories, setMyStories] = useState<Story[]>([])   // child's own AI-generated stories
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [voicing, setVoicing] = useState<Set<string>>(new Set())   // stories getting audio built

  async function makeVoice(id: string) {
    setVoicing(s => new Set(s).add(id))
    await api.post(`/api/ai/stories/${id}/audio`, {})
    setVoicing(s => { const n = new Set(s); n.delete(id); return n })
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [storiesRes, childRes] = await Promise.all([
        api.get<Story[]>('/api/stories'),
        api.get<Child[]>('/api/children'),
      ])
      if (storiesRes.data) setStories(storiesRes.data)
      const child = pickChild(childRes.data ?? [])
      if (child) {
        const [progRes, mineRes] = await Promise.all([
          api.get<{ stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${child.id}`),
          api.get<Story[]>(`/api/ai/stories/${child.id}`),
        ])
        if (progRes.data) {
          setCompleted(new Set(progRes.data.stories.filter(s => s.completed).map(s => s.story_id)))
        }
        if (mineRes.data) setMyStories(mineRes.data)
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

      <div className="px-4 lg:px-8 pt-5">
        {/* Generate a personalized story with AI */}
        <Link
          href="/child/story/new"
          aria-label="یک داستان جدید برای من بساز"
          className="flex items-center gap-3 mb-4 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white rounded-[1.5rem] p-4 shadow-md"
        >
          <span className="text-3xl" aria-hidden="true">✨</span>
          <div className="flex-1 text-right">
            <p className="font-bold leading-tight">یک داستان برای من بساز</p>
            <p className="text-xs text-white/85 mt-0.5 persian-text">داستان مخصوص خودت با موضوع دلخواه</p>
          </div>
          <span className="text-2xl" aria-hidden="true">←</span>
        </Link>

        {/* The child's own AI-generated stories (kept out of the main catalogue,
            so this is the only place they can re-open them). */}
        {myStories.length > 0 && (
          <section className="mb-6" aria-label="داستان‌های من">
            <h2 className="font-bold text-gray-800 text-base mb-3">داستان‌های من ✨</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" role="list">
              {myStories.map(story => {
                const done = completed.has(story.id)
                const busy = voicing.has(story.id)
                return (
                  <div key={story.id} role="listitem" className="bg-white rounded-lg shadow-sm overflow-hidden relative">
                    <Link
                      href={`/child/story/${story.id}`}
                      aria-label={`${story.title_persian}${done ? ' — خوانده شده' : ''}`}
                      className="block hover:opacity-95 transition-opacity"
                    >
                      {done && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full z-10 font-medium" aria-hidden="true">
                          ✅ خوندم
                        </div>
                      )}
                      <div className="w-full h-32 bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-5xl" aria-hidden="true">✨</div>
                      <div className="px-3 pt-3">
                        <p className="font-bold text-gray-800 text-sm leading-tight persian-text">{story.title_persian}</p>
                        <p className="text-xs text-fuchsia-500 mt-1">داستان من</p>
                      </div>
                    </Link>
                    <button
                      onClick={() => makeVoice(story.id)}
                      disabled={busy}
                      className="w-full mt-2 mb-2.5 text-xs font-medium text-purple-700 hover:text-purple-900 disabled:opacity-60"
                    >
                      {busy ? '...در حال ساخت صدا' : '🔊 ساخت صدا'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {myStories.length > 0 && stories.length > 0 && (
          <h2 className="font-bold text-gray-800 text-base mb-3">داستان‌های آماده 📚</h2>
        )}

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
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
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
                    className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden relative"
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
                      <div className="relative w-full h-32">
                        <Image
                          src={mediaUrl(story.cover_url)!}
                          alt={story.title_persian}
                          fill
                          sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                          className="object-cover"
                        />
                      </div>
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
