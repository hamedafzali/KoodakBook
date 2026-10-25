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
import Emoji from '@/components/shared/Emoji'
import StoryCover from '@/components/child/StoryCover'
import { SectionTitle } from '@/components/child/kit'
import { softClayVars } from '@/components/child/clay'
import { pickChild } from '@/lib/activeChild'
import { toPersianDigits } from '@koodakbook/shared'
import type { Story, Child } from '@koodakbook/shared'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1 } }

export default function StoryListPage() {
  const router = useRouter()
  const [stories, setStories] = useState<Story[]>([])
  const [myStories, setMyStories] = useState<Story[]>([])   // child's own AI-generated stories
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  // Failed ≠ empty: a failed catalogue fetch used to show «هنوز داستانی نیست».
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [voicing, setVoicing] = useState<Set<string>>(new Set())   // stories getting audio built

  async function makeVoice(id: string) {
    setVoicing(s => new Set(s).add(id))
    await api.post(`/api/ai/stories/${id}/audio`, {})
    setVoicing(s => { const n = new Set(s); n.delete(id); return n })
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    let cancelled = false
    async function load() {
      const [storiesRes, childRes] = await Promise.all([
        api.get<Story[]>('/api/stories'),
        api.get<Child[]>('/api/children'),
      ])
      if (cancelled) return
      if (!storiesRes.data) { setLoadError(storiesRes.error ?? 'اتصال برقرار نشد. دوباره تلاش کن'); setLoading(false); return }
      setStories(storiesRes.data)
      const child = pickChild(childRes.data ?? [])
      if (child) {
        const [progRes, mineRes] = await Promise.all([
          api.get<{ stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${child.id}`),
          api.get<Story[]>(`/api/ai/stories/${child.id}`),
        ])
        if (cancelled) return
        if (progRes.data) {
          setCompleted(new Set(progRes.data.stories.filter(s => s.completed).map(s => s.story_id)))
        }
        if (mineRes.data) setMyStories(mineRes.data)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [router, attempt])

  if (loading) return <LoadingScreen message="در حال بارگذاری داستان‌ها..." />
  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => { setLoadError(null); setLoading(true); setAttempt(a => a + 1) }} />
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader
        title="همه داستان‌ها"
        subtitle={`${toPersianDigits(stories.length)} داستان موجود است`}
        module="stories"
      />

      <div className="px-4 lg:px-8 pt-5">
        {/* Generate a personalized story with AI — the one strong gradient on
            this screen (DESIGN_CHARTER.md), a magic fuchsia→purple that reads
            as "special", not the stories hue everything else uses. */}
        <Link
          href="/child/story/new"
          aria-label="یک داستان جدید برای من بساز"
          className="flex items-center gap-3 mb-5 text-white rounded-3xl p-4 shadow-raised bg-gradient-to-l from-fuchsia-600 to-purple-700"
        >
          <span className="text-4xl" aria-hidden="true">✨</span>
          <div className="flex-1 min-w-0 text-start">
            <p className="font-display font-black text-card-title leading-tight">یک داستان برای من بساز</p>
            <p className="text-small text-white/90 mt-0.5 persian-text">داستان مخصوص خودت با موضوع دلخواه</p>
          </div>
          <span className="text-2xl" aria-hidden="true">←</span>
        </Link>

        {/* The child's own AI-generated stories (kept out of the main catalogue,
            so this is the only place they can re-open them). */}
        {myStories.length > 0 && (
          <section className="mb-6" aria-labelledby="my-stories-title">
            <SectionTitle module="stories" id="my-stories-title">داستان‌های من <span aria-hidden="true">✨</span></SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" role="list">
              {myStories.map(story => {
                const done = completed.has(story.id)
                const busy = voicing.has(story.id)
                return (
                  <div key={story.id} role="listitem" className="clay-static overflow-hidden relative" style={softClayVars('stories')}>
                    <Link
                      href={`/child/story/${story.id}`}
                      aria-label={`${story.title_persian}${done ? ' — خوانده شده' : ''}`}
                      className="block hover:opacity-95 transition-opacity"
                    >
                      {done && (
                        <div className="absolute top-2 end-2 bg-green-700 text-white text-xs px-2 py-0.5 rounded-full z-10 font-medium" aria-hidden="true">
                          <span aria-hidden="true">✅</span> خوندم
                        </div>
                      )}
                      <div className="w-full h-32 flex items-center justify-center bg-gradient-to-br from-fuchsia-500 to-purple-600" aria-hidden="true"><span className="text-5xl" aria-hidden="true">✨</span></div>
                      <div className="px-3 pt-3">
                        <p className="font-bold text-text-primary text-body leading-tight persian-text">{story.title_persian}</p>
                        <p className="text-small text-fuchsia-700 mt-1">داستان من</p>
                      </div>
                    </Link>
                    {/* Every card's button read just «ساخت صدا» — ambiguous in
                        a list — and was a ~34px strip; named per story now and
                        held to the 48px list-item floor. */}
                    <button
                      onClick={() => makeVoice(story.id)}
                      disabled={busy}
                      aria-label={busy ? `در حال ساخت صدا برای ${story.title_persian}` : `ساخت صدا برای ${story.title_persian}`}
                      aria-busy={busy || undefined}
                      className="w-full min-h-[48px] inline-flex items-center justify-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-900 disabled:opacity-60"
                    >
                      {busy ? '...در حال ساخت صدا' : <><Emoji name="speaker-high-volume" size={14} /> ساخت صدا</>}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {myStories.length > 0 && stories.length > 0 && (
          <SectionTitle module="stories">داستان‌های آماده <span aria-hidden="true">📚</span></SectionTitle>
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
            {stories.map(story => {
              const done = completed.has(story.id)
              return (
                <motion.div key={story.id} variants={item} role="listitem">
                  <Link
                    href={`/child/story/${story.id}`}
                    aria-label={`${story.title_persian}${done ? ' — خوانده شده' : ''}${story.age_min ? `، برای ${toPersianDigits(story.age_min)} تا ${toPersianDigits(story.age_max ?? '')} سال` : ''}`}
                    className="clay-static block overflow-hidden relative"
                    style={softClayVars('stories')}
                  >
                    {done && (
                      <div
                        className="absolute top-2 end-2 bg-green-700 text-white text-xs px-2 py-0.5 rounded-full z-10 font-medium"
                        aria-hidden="true"
                      >
                        <span aria-hidden="true">✅</span> خوندم
                      </div>
                    )}
                    {/* Same cover Home's featured row draws for this story
                        (StoryCover): real art, else one vivid hue per story. */}
                    <StoryCover id={story.id} coverUrl={story.cover_url}
                      sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
                    <div className="p-3">
                      <p className="font-bold text-text-primary text-body leading-tight persian-text">{story.title_persian}</p>
                      {story.age_min && (
                        <p className="text-small text-text-secondary mt-1">
                          {toPersianDigits(story.age_min)}–{toPersianDigits(story.age_max ?? '')} سال
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
