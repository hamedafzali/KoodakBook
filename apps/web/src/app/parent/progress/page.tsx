'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import type { Child, ChildWordProgress, ChildLessonProgress, ChildStoryProgress, ChildSession, Word, Lesson, Story } from '@koodakbook/shared'

interface RawProgress {
  words:           ChildWordProgress[]
  lessons:         ChildLessonProgress[]
  stories:         ChildStoryProgress[]
  recent_sessions: ChildSession[]
}

interface EnrichedProgress {
  words:           (ChildWordProgress & { word?: Word })[]
  lessons:         (ChildLessonProgress & { lesson?: Lesson })[]
  stories:         (ChildStoryProgress & { story?: Story })[]
  recent_sessions: ChildSession[]
}

const STATUS_COLOR: Record<string, string> = {
  introduced: 'bg-gray-100 text-gray-500',
  practiced:  'bg-amber-100 text-amber-700',
  mastered:   'bg-green-100 text-green-700',
}
const STATUS_LABEL: Record<string, string> = {
  introduced: 'معرفی شده',
  practiced:  'تمرین شده',
  mastered:   'یاد گرفته',
}

export default function ParentProgressPage() {
  const router = useRouter()
  const [child, setChild] = useState<Child | null>(null)
  const [progress, setProgress] = useState<EnrichedProgress | null>(null)
  const [tab, setTab] = useState<'words' | 'lessons' | 'stories' | 'sessions'>('words')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }

    async function load() {
      try {
        const childRes = await api.get<Child[]>('/api/children')
        if (!childRes.data?.[0]) { setLoading(false); return }
        const c = childRes.data[0]
        setChild(c)

        const [progRes, wordsRes, lessonsRes, storiesRes] = await Promise.all([
          api.get<RawProgress>(`/api/progress/${c.id}`),
          api.get<Word[]>('/api/words'),
          api.get<Lesson[]>('/api/lessons'),
          api.get<Story[]>('/api/stories'),
        ])

        if (progRes.data) {
          const wordMap   = Object.fromEntries((wordsRes.data   ?? []).map(w => [w.id, w]))
          const lessonMap = Object.fromEntries((lessonsRes.data ?? []).map(l => [l.id, l]))
          const storyMap  = Object.fromEntries((storiesRes.data ?? []).map(s => [s.id, s]))

          setProgress({
            words:           progRes.data.words.map(w => ({ ...w, word: wordMap[w.word_id] })),
            lessons:         progRes.data.lessons.map(l => ({ ...l, lesson: lessonMap[l.lesson_id] })),
            stories:         progRes.data.stories.map(s => ({ ...s, story: storyMap[s.story_id] })),
            recent_sessions: progRes.data.recent_sessions,
          })
        }
      } catch (err) {
        console.error('Progress load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">در حال بارگذاری...</div>
  if (!child)  return <div className="min-h-screen flex items-center justify-center text-gray-500">پروفایل کودک یافت نشد</div>

  const wordsByStatus = {
    mastered:   progress?.words.filter(w => w.status === 'mastered')   ?? [],
    practiced:  progress?.words.filter(w => w.status === 'practiced')  ?? [],
    introduced: progress?.words.filter(w => w.status === 'introduced') ?? [],
  }

  const TABS = [
    { key: 'words',    label: 'کلمات',    count: progress?.words.length ?? 0 },
    { key: 'lessons',  label: 'درس‌ها',   count: progress?.lessons.filter(l => l.completed).length ?? 0 },
    { key: 'stories',  label: 'داستان‌ها', count: progress?.stories.length ?? 0 },
    { key: 'sessions', label: 'جلسات',    count: progress?.recent_sessions.length ?? 0 },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex items-center gap-4">
        <Link href="/parent/dashboard" className="text-gray-400 text-2xl hover:text-gray-600">←</Link>
        <div>
          <h1 className="font-bold text-xl text-gray-800">پیشرفت {child.name}</h1>
          <p className="text-sm text-gray-400">گزارش کامل یادگیری</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-4">
        <div className="bg-green-50 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{wordsByStatus.mastered.length}</p>
          <p className="text-xs text-green-600 mt-0.5">کلمه یاد گرفته</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{progress?.lessons.filter(l => l.completed).length ?? 0}</p>
          <p className="text-xs text-amber-600 mt-0.5">درس تمام شده</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{progress?.stories.filter(s => s.completed).length ?? 0}</p>
          <p className="text-xs text-blue-600 mt-0.5">داستان خوانده</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
              tab === t.key ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border'
            }`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 pb-8 space-y-3">

        {/* Words */}
        {tab === 'words' && (
          <div className="space-y-4">
            {(progress?.words.length ?? 0) === 0 && (
              <p className="text-center text-gray-400 py-8">هنوز کلمه‌ای یاد نگرفته</p>
            )}
            {(['mastered', 'practiced', 'introduced'] as const).map(status =>
              wordsByStatus[status].length > 0 && (
                <section key={status}>
                  <h3 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
                    <span className="text-gray-400">{wordsByStatus[status].length} کلمه</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {wordsByStatus[status].map(w => (
                      <div key={w.id} className={`px-3 py-1.5 rounded-xl text-sm font-medium ${STATUS_COLOR[status]}`}>
                        {w.word?.persian ?? '—'}
                      </div>
                    ))}
                  </div>
                </section>
              )
            )}
          </div>
        )}

        {/* Lessons */}
        {tab === 'lessons' && (
          <div className="space-y-2">
            {(progress?.lessons.length ?? 0) === 0 && <p className="text-center text-gray-400 py-8">هنوز درسی شروع نشده</p>}
            {progress?.lessons.map(l => (
              <div key={l.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <span className="text-2xl">{l.completed ? '✅' : '⏳'}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{l.lesson?.title ?? '—'}</p>
                  {l.completed && l.completed_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(l.completed_at).toLocaleDateString('fa-IR')}
                      {l.score != null && ` • نمره: ${l.score}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stories */}
        {tab === 'stories' && (
          <div className="space-y-2">
            {(progress?.stories.length ?? 0) === 0 && <p className="text-center text-gray-400 py-8">هنوز داستانی خوانده نشده</p>}
            {progress?.stories.map(s => (
              <div key={s.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <span className="text-2xl">{s.completed ? '📖' : '📄'}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{s.story?.title_persian ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.completed ? 'خوانده شده' : `صفحه ${s.last_page}`}
                    {s.replay_count > 0 && ` • ${s.replay_count} بار تکرار`}
                    {` • ${new Date(s.last_read_at).toLocaleDateString('fa-IR')}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sessions */}
        {tab === 'sessions' && (
          <div className="space-y-2">
            {(progress?.recent_sessions.length ?? 0) === 0 && <p className="text-center text-gray-400 py-8">هنوز جلسه‌ای ثبت نشده</p>}
            {progress?.recent_sessions.map((s, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📅</span>
                  <span className="text-gray-700">{new Date(s.started_at).toLocaleDateString('fa-IR')}</span>
                </div>
                <span className="text-sm text-gray-400">
                  {s.duration_sec ? `${Math.round(s.duration_sec / 60)} دقیقه` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
