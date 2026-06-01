'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import StoryReader from '@/components/child/StoryReader'
import RewardPopup from '@/components/child/RewardPopup'
import type { Story, StoryPage, Badge, Child } from '@koodakbook/shared'

type FullStory = Story & { pages: StoryPage[] }

export default function StoryPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [story, setStory] = useState<FullStory | null>(null)
  const [childId, setChildId] = useState('')
  const [showBilingual, setShowBilingual] = useState(true)
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

  if (!story) return <div className="min-h-screen flex items-center justify-center text-gray-500">در حال بارگذاری...</div>

  return (
    <>
      {newBadge && <RewardPopup badge={newBadge} onClose={() => router.push('/child/home')} />}
      <div className="fixed top-4 left-4 z-10 flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow text-sm">
        <span>ترجمه</span>
        <button onClick={() => setShowBilingual(v => !v)}
          className={`w-10 h-6 rounded-full transition ${showBilingual ? 'bg-amber-500' : 'bg-gray-300'}`}>
          <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${showBilingual ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
      <StoryReader story={story} showBilingual={showBilingual} onPageChange={handlePageChange} onComplete={handleComplete} />
    </>
  )
}
