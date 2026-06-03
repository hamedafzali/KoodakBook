'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import StoryReader from '@/components/child/StoryReader'
import RewardPopup from '@/components/child/RewardPopup'
import LoadingScreen from '@/components/child/LoadingScreen'
import type { Story, StoryPage, Badge, Child } from '@koodakbook/shared'

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

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [storyRes, childRes] = await Promise.all([
        api.get<FullStory>(`/api/stories/${id}`),
        api.get<Child[]>('/api/children'),
      ])
      if (storyRes.data) setStory(storyRes.data)
      if (childRes.data?.[0]) setChildId(childRes.data[0].id)
    }
    load()
  }, [id, router])

  async function handlePageChange(page: number) {
    if (!childId || !story) return
    await api.post('/api/progress/story', { child_id: childId, story_id: story.id, last_page: page })
  }

  async function handleComplete() {
    if (!childId || !story) return
    const res = await api.post<{ new_badges: Badge[] }>(
      '/api/progress/story',
      { child_id: childId, story_id: story.id, last_page: story.pages.length - 1, completed: true }
    )
    if (res.data?.new_badges?.[0]) setNewBadge(res.data.new_badges[0])
    else router.push('/child/home')
  }

  if (!story) return <LoadingScreen message="در حال بارگذاری داستان..." />

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
