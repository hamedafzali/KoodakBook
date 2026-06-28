'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { motion } from 'framer-motion'
import StoryReader from '@/components/child/StoryReader'
import RewardPopup from '@/components/child/RewardPopup'
import LoadingScreen from '@/components/child/LoadingScreen'
import Mascot from '@/components/child/Mascot'
import { pickChild } from '@/lib/activeChild'
import type { Story, StoryPage, Badge, Child, Promotion } from '@koodakbook/shared'

type FullStory = Story & { pages: StoryPage[] }

export default function StoryPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [story, setStory] = useState<FullStory | null>(null)
  const [childId, setChildId] = useState('')
  const [showBilingual, setShowBilingual] = useState(true)

  // Honor the parent's translation preference as the default
  useEffect(() => {
    const pref = localStorage.getItem('koodakbook_show_translation')
    if (pref !== null) setShowBilingual(pref === '1')
  }, [])
  const [newBadge, setNewBadge] = useState<Badge | null>(null)
  const [showUnlock, setShowUnlock] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [storyRes, childRes] = await Promise.all([
        api.get<FullStory>(`/api/stories/${id}`),
        api.get<Child[]>('/api/children'),
      ])
      if (storyRes.data) setStory(storyRes.data)
      const child = pickChild(childRes.data ?? [])
      if (child) setChildId(child.id)
    }
    load()
  }, [id, router])

  // Self-heal: an AI story (created for this child) with any silent page builds
  // its own audio (free Piper), then we refetch so بشنو plays — no manual step.
  useEffect(() => {
    if (!story) return
    const isAi = !!(story as { created_for_child?: string | null }).created_for_child
    if (!isAi || !story.pages.some(p => !p.audio_url)) return
    let cancelled = false
    api.post(`/api/ai/stories/${story.id}/audio`, {})
      .then(async () => {
        if (cancelled) return
        const r = await api.get<FullStory>(`/api/stories/${story.id}`)
        if (r.data && !cancelled) setStory(r.data)
      })
      .catch(() => { /* leave text-only; the manual button remains */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id])

  async function handlePageChange(page: number) {
    if (!childId || !story) return
    await api.post('/api/progress/story', { child_id: childId, story_id: story.id, last_page: page })
  }

  async function handleComplete() {
    if (!childId || !story) return
    try {
      // new_badges / promotions are top-level on the response, not under `data`.
      const res = await api.post('/api/progress/story',
        { child_id: childId, story_id: story.id, last_page: story.pages.length - 1, completed: true }
      ) as { new_badges?: Badge[]; promotions?: Promotion[] }
      if (res.new_badges?.[0]) setNewBadge(res.new_badges[0])
      else if (res.promotions?.length) {
        setShowUnlock(true)
        setTimeout(() => router.push('/child/home'), 2600)
      }
      else router.push('/child/home')
    } catch {
      router.push('/child/home')   // never leave the child stuck on the last page
    }
  }

  if (!story) return <LoadingScreen message="در حال بارگذاری داستان..." />

  if (showUnlock) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 text-center gap-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <Mascot size={120} mood="excited" />
        </motion.div>
        <p className="text-3xl">🔓✨</p>
        <h1 className="text-2xl font-bold text-gray-800">محتوای جدید باز شد!</h1>
        <p className="text-gray-500 persian-text">داستان‌ها و درس‌های تازه در خانه منتظرت هستند</p>
      </div>
    )
  }

  return (
    <>
      {newBadge && <RewardPopup badge={newBadge} onClose={() => router.push('/child/home')} />}

      {/* Translation toggle — correctly positioned at end-side in RTL (right edge) */}
      <div className="fixed top-4 right-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur rounded-full px-3 py-2 shadow-md text-sm">
        <span className="text-gray-600 text-xs font-medium">ترجمه</span>
        <button
          onClick={() => setShowBilingual(v => !v)}
          role="switch"
          aria-checked={showBilingual}
          aria-label={showBilingual ? 'غیرفعال کردن ترجمه' : 'فعال کردن ترجمه'}
          className={`w-11 h-6 rounded-full transition-colors relative ${showBilingual ? 'bg-amber-500' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
              showBilingual ? 'right-1' : 'right-6'
            }`}
          />
        </button>
      </div>

      <StoryReader
        story={story}
        showBilingual={showBilingual}
        onBack={() => router.push('/child/story')}
        onPageChange={handlePageChange}
        onComplete={handleComplete}
      />
    </>
  )
}
