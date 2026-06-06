'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import ParentGate from '@/components/parent/ParentGate'
import { pickChild } from '@/lib/activeChild'
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

type TabKey = 'words' | 'lessons' | 'stories' | 'sessions'

export default function ParentProgressPage() {
  const router = useRouter()
  const [child, setChild] = useState<Child | null>(null)
  const [progress, setProgress] = useState<EnrichedProgress | null>(null)
  const [tab, setTab] = useState<TabKey>('words')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      try {
        const childRes = await api.get<Child[]>('/api/children')
        const c = pickChild(childRes.data ?? [])
        if (!c) { setLoading(false); return }
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-gray-400 persian-text">در حال بارگذاری...</p>
    </div>
  )
  if (!child) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-gray-400 persian-text">پروفایل کودک یافت نشد</p>
    </div>
  )

  const wordsByStatus = {
    mastered:   progress?.words.filter(w => w.status === 'mastered')   ?? [],
    practiced:  progress?.words.filter(w => w.status === 'practiced')  ?? [],
    introduced: progress?.words.filter(w => w.status === 'introduced') ?? [],
  }

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'words',    label: 'کلمات',    count: progress?.words.length ?? 0 },
    { key: 'lessons',  label: 'درس‌ها',   count: progress?.lessons.filter(l => l.completed).length ?? 0 },
    { key: 'stories',  label: 'داستان‌ها', count: progress?.stories.length ?? 0 },
    { key: 'sessions', label: 'جلسات',    count: progress?.recent_sessions.length ?? 0 },
  ]

  return (
    <ParentGate>
      <div className="min-h-screen bg-slate-50">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center gap-3">
          <Link
            href="/parent/dashboard"
            aria-label="برگشت به داشبورد"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
          <div>
            <h1 className="font-bold text-xl text-slate-800">پیشرفت {child.name}</h1>
            <p className="text-sm text-slate-400">گزارش کامل یادگیری</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 px-4 pt-4">
          <div className="bg-green-50 rounded-[1.25rem] p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{wordsByStatus.mastered.length}</p>
            <p className="text-xs text-green-600 mt-0.5">کلمه یاد گرفته</p>
          </div>
          <div className="bg-amber-50 rounded-[1.25rem] p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{progress?.lessons.filter(l => l.completed).length ?? 0}</p>
            <p className="text-xs text-amber-600 mt-0.5">درس تمام شده</p>
          </div>
          <div className="bg-blue-50 rounded-[1.25rem] p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{progress?.stories.filter(s => s.completed).length ?? 0}</p>
            <p className="text-xs text-blue-600 mt-0.5">داستان خوانده</p>
          </div>
        </div>

        {/* Sticky tabs */}
        <div
          className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 flex gap-1 px-4 pt-3 pb-0 overflow-x-auto"
          role="tablist"
          aria-label="دسته‌بندی پیشرفت"
        >
          {TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-colors border-b-2 ${
                tab === t.key
                  ? 'bg-white border-amber-500 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="px-4 pt-4 pb-8 space-y-3">

          {/* Words panel */}
          <div
            role="tabpanel"
            id="panel-words"
            aria-labelledby="tab-words"
            hidden={tab !== 'words'}
          >
            <div className="space-y-4">
              {(progress?.words.length ?? 0) === 0 && (
                <p className="text-center text-slate-400 py-8 persian-text">هنوز کلمه‌ای یاد نگرفته</p>
              )}
              {(['mastered', 'practiced', 'introduced'] as const).map(status =>
                wordsByStatus[status].length > 0 && (
                  <section key={status} aria-labelledby={`status-${status}`}>
                    <h3 id={`status-${status}`} className="text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
                      <span className="text-slate-400">{wordsByStatus[status].length} کلمه</span>
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
          </div>

          {/* Lessons panel */}
          <div
            role="tabpanel"
            id="panel-lessons"
            aria-labelledby="tab-lessons"
            hidden={tab !== 'lessons'}
          >
            <div className="space-y-2">
              {(progress?.lessons.length ?? 0) === 0 && (
                <p className="text-center text-slate-400 py-8 persian-text">هنوز درسی شروع نشده</p>
              )}
              {progress?.lessons.map(l => (
                <div key={l.id} className="bg-white rounded-[1.25rem] p-4 flex items-center gap-4 shadow-sm">
                  <span className="text-2xl" aria-hidden="true">{l.completed ? '✅' : '⏳'}</span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{l.lesson?.title ?? '—'}</p>
                    {l.completed && l.completed_at && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(l.completed_at).toLocaleDateString('fa-IR')}
                        {l.score != null && ` · نمره: ${l.score}٪`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stories panel */}
          <div
            role="tabpanel"
            id="panel-stories"
            aria-labelledby="tab-stories"
            hidden={tab !== 'stories'}
          >
            <div className="space-y-2">
              {(progress?.stories.length ?? 0) === 0 && (
                <p className="text-center text-slate-400 py-8 persian-text">هنوز داستانی خوانده نشده</p>
              )}
              {progress?.stories.map(s => (
                <div key={s.id} className="bg-white rounded-[1.25rem] p-4 flex items-center gap-4 shadow-sm">
                  <span className="text-2xl" aria-hidden="true">{s.completed ? '📖' : '📄'}</span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{s.story?.title_persian ?? '—'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.completed ? 'خوانده شده' : `صفحه ${s.last_page}`}
                      {s.replay_count > 0 && ` · ${s.replay_count} بار تکرار`}
                      {` · ${new Date(s.last_read_at).toLocaleDateString('fa-IR')}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sessions panel */}
          <div
            role="tabpanel"
            id="panel-sessions"
            aria-labelledby="tab-sessions"
            hidden={tab !== 'sessions'}
          >
            <div className="space-y-2">
              {(progress?.recent_sessions.length ?? 0) === 0 && (
                <p className="text-center text-slate-400 py-8 persian-text">هنوز جلسه‌ای ثبت نشده</p>
              )}
              {progress?.recent_sessions.map((s, i) => (
                <div key={i} className="bg-white rounded-[1.25rem] p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xl" aria-hidden="true">📅</span>
                    <span className="text-slate-700">{new Date(s.started_at).toLocaleDateString('fa-IR')}</span>
                  </div>
                  <span className="text-sm text-slate-400">
                    {s.duration_sec ? `${Math.round(s.duration_sec / 60)} دقیقه` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ParentGate>
  )
}
