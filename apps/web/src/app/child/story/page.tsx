'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { mediaUrl } from '@/lib/media'
import type { Story, Child } from '@koodakbook/shared'

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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">در حال بارگذاری...</div>

  return (
    <div className="min-h-screen bg-amber-50 pb-24">
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 pt-10 pb-6 rounded-b-3xl text-white">
        <button onClick={() => router.back()} className="text-amber-100 mb-3 block">← برگشت</button>
        <h1 className="text-2xl font-bold">همه داستان‌ها 📖</h1>
        <p className="text-amber-100 text-sm mt-1">{stories.length} داستان موجود است</p>
      </div>

      <div className="px-4 pt-6 grid grid-cols-2 gap-4">
        {stories.map(story => {
          const done = completed.has(story.id)
          return (
            <Link key={story.id} href={`/child/story/${story.id}`}
              className="bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden relative">
              {done && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full z-10">✅ خوندم</div>
              )}
              {mediaUrl(story.cover_url)
                ? <img src={mediaUrl(story.cover_url)!} alt={story.title_english} className="w-full h-28 object-cover" />
                : <div className="w-full h-28 bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center text-5xl">📖</div>
              }
              <div className="p-3">
                <p className="font-bold text-gray-800 text-sm leading-tight">{story.title_persian}</p>
                {story.age_min && <p className="text-xs text-gray-400 mt-1">{story.age_min}–{story.age_max} سال</p>}
              </div>
            </Link>
          )
        })}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-3 px-4">
        <Link href="/child/home"    className="flex flex-col items-center gap-1 text-gray-400"><span className="text-2xl">🏠</span><span className="text-xs">خانه</span></Link>
        <Link href="/child/lesson"  className="flex flex-col items-center gap-1 text-gray-400"><span className="text-2xl">📚</span><span className="text-xs">درس‌ها</span></Link>
        <Link href="/child/story"   className="flex flex-col items-center gap-1 text-amber-600"><span className="text-2xl">📖</span><span className="text-xs font-medium">داستان</span></Link>
        <Link href="/child/rewards" className="flex flex-col items-center gap-1 text-gray-400"><span className="text-2xl">🏆</span><span className="text-xs">جوایز</span></Link>
      </nav>
    </div>
  )
}
