'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import type { Lesson, Child } from '@koodakbook/shared'

const TYPE_EMOJI: Record<string, string> = { vocabulary: '📚', alphabet: '🔤', phonics: '🎵' }
const TYPE_LABEL: Record<string, string> = { vocabulary: 'واژگان', alphabet: 'الفبا', phonics: 'آواشناسی' }

export default function LessonListPage() {
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progress, setProgress] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [lessonsRes, childRes] = await Promise.all([
        api.get<Lesson[]>('/api/lessons'),
        api.get<Child[]>('/api/children'),
      ])
      if (lessonsRes.data) setLessons(lessonsRes.data)
      if (childRes.data?.[0]) {
        const progRes = await api.get<{ lessons: { lesson_id: string; completed: boolean }[] }>(
          `/api/progress/${childRes.data[0].id}`
        )
        if (progRes.data) {
          const map: Record<string, boolean> = {}
          progRes.data.lessons.forEach(l => { map[l.lesson_id] = l.completed })
          setProgress(map)
        }
      }
      setLoading(false)
    }
    load()
  }, [router])

  const grouped = lessons.reduce<Record<string, Lesson[]>>((acc, l) => {
    acc[l.type] = [...(acc[l.type] ?? []), l]
    return acc
  }, {})

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">در حال بارگذاری...</div>

  return (
    <div className="min-h-screen bg-amber-50 pb-24">
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 pt-10 pb-6 rounded-b-3xl text-white">
        <button onClick={() => router.back()} className="text-amber-100 mb-3 block">← برگشت</button>
        <h1 className="text-2xl font-bold">همه درس‌ها 📚</h1>
        <p className="text-amber-100 text-sm mt-1">{lessons.length} درس موجود است</p>
      </div>

      <div className="px-4 pt-6 space-y-6">
        {Object.entries(grouped).map(([type, items]) => (
          <section key={type}>
            <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="text-xl">{TYPE_EMOJI[type]}</span>
              {TYPE_LABEL[type] ?? type}
            </h2>
            <div className="space-y-2">
              {items.map(lesson => {
                const done = progress[lesson.id]
                return (
                  <Link key={lesson.id} href={`/child/lesson/${lesson.id}`}
                    className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${done ? 'bg-green-100' : 'bg-amber-100'}`}>
                      {done ? '✅' : TYPE_EMOJI[lesson.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800">{lesson.title}</p>
                      {lesson.description && <p className="text-xs text-gray-400 truncate">{lesson.description}</p>}
                    </div>
                    <span className="text-gray-300 flex-shrink-0">←</span>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-3 px-4">
        <Link href="/child/home"    className="flex flex-col items-center gap-1 text-gray-400"><span className="text-2xl">🏠</span><span className="text-xs">خانه</span></Link>
        <Link href="/child/lesson"  className="flex flex-col items-center gap-1 text-amber-600"><span className="text-2xl">📚</span><span className="text-xs font-medium">درس‌ها</span></Link>
        <Link href="/child/story"   className="flex flex-col items-center gap-1 text-gray-400"><span className="text-2xl">📖</span><span className="text-xs">داستان</span></Link>
        <Link href="/child/rewards" className="flex flex-col items-center gap-1 text-gray-400"><span className="text-2xl">🏆</span><span className="text-xs">جوایز</span></Link>
      </nav>
    </div>
  )
}
