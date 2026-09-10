'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import type { Child, ChildWordProgress, ChildLessonProgress, ChildStoryProgress, ChildSession, Word, Lesson, Story } from '@koodakbook/shared'
import { containerWidths } from '@/components/shared/layout'
import { Icon } from '@/components/icons'
import { Panel, Stat } from '@/components/parent/flat'

/* Flat register (components/parent/flat.tsx). Three things changed in the
 * migration beyond swapping containers for Panel:
 *
 *  - The summary trio was three hand-picked pastel families (green-50/700,
 *    amber-50/700, blue-50/700). They are now `Stat`s on shared ramps, so the
 *    soft/ink pairing is the one the ramp generator solved for AA rather than
 *    three separate guesses.
 *  - Every `text-slate-400` on a metadata line was 2.56:1 on white and 2.34:1
 *    on the parent ground — below AA for text. They are now `text-parent-muted`
 *    (7.58 / 6.92).
 *  - The back chevron was a hand-rolled inline SVG, the one place in this app
 *    still drawing an icon by hand instead of using the icon set. */

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

// Mastery state machine (mig-016) — 4 states, ordered strongest → weakest.
const MASTERY_ORDER = ['consolidated', 'mastered', 'practicing', 'introduced'] as const
type MasteryKey = typeof MASTERY_ORDER[number]

/* Four states, and the ordering has to be legible without reading the label:
 * strongest is the most saturated. `introduced` was gray-100/gray-500 — 3.6:1,
 * under AA, and the only tint on this page that wasn't from the palette. */
const MASTERY_COLOR: Record<MasteryKey, string> = {
  consolidated: 'bg-emerald-100 text-emerald-800',
  mastered:     'bg-green-100 text-green-800',
  practicing:   'bg-amber-100 text-amber-900',
  introduced:   'bg-slate-100 text-slate-700',
}
const MASTERY_LABEL: Record<MasteryKey, string> = {
  consolidated: 'تثبیت‌شده',
  mastered:     'یاد گرفته',
  practicing:   'در حال تمرین',
  introduced:   'معرفی شده',
}

// Fall back to the legacy 3-state status for any row not yet migrated.
function effectiveMastery(w: { mastery?: string; status: string }): MasteryKey {
  if (w.mastery && w.mastery in MASTERY_COLOR) return w.mastery as MasteryKey
  if (w.status === 'mastered') return 'mastered'
  if (w.status === 'practiced') return 'practicing'
  return 'introduced'
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
    <div className="min-h-screen flex items-center justify-center bg-parent-bg">
      <p className="text-parent-muted persian-text">در حال بارگذاری...</p>
    </div>
  )
  if (!child) return (
    <div className="min-h-screen flex items-center justify-center bg-parent-bg">
      <p className="text-parent-muted persian-text">پروفایل کودک یافت نشد</p>
    </div>
  )

  const wordsByMastery: Record<MasteryKey, EnrichedProgress['words']> = {
    consolidated: progress?.words.filter(w => effectiveMastery(w) === 'consolidated') ?? [],
    mastered:     progress?.words.filter(w => effectiveMastery(w) === 'mastered')     ?? [],
    practicing:   progress?.words.filter(w => effectiveMastery(w) === 'practicing')   ?? [],
    introduced:   progress?.words.filter(w => effectiveMastery(w) === 'introduced')   ?? [],
  }
  const learnedCount = wordsByMastery.consolidated.length + wordsByMastery.mastered.length

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'words',    label: 'کلمات',    count: progress?.words.length ?? 0 },
    { key: 'lessons',  label: 'درس‌ها',   count: progress?.lessons.filter(l => l.completed).length ?? 0 },
    { key: 'stories',  label: 'داستان‌ها', count: progress?.stories.length ?? 0 },
    { key: 'sessions', label: 'جلسات',    count: progress?.recent_sessions.length ?? 0 },
  ]

  return (
      <div className={`min-h-screen bg-parent-bg ${containerWidths.app}`}>

        {/* Header */}
        <div className="bg-parent-surface border-b border-slate-200 px-5 py-4 flex items-center gap-3">
          <Link
            href="/parent/dashboard"
            aria-label="برگشت به داشبورد"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-parent-muted hover:text-parent-text hover:bg-slate-100 transition-colors"
          >
            <Icon name="back" size="md" />
          </Link>
          <div>
            <h1 className="font-bold text-xl text-parent-text">پیشرفت {child.name}</h1>
            <p className="text-sm text-parent-muted">گزارش کامل یادگیری</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex gap-3 px-4 pt-4">
          <Stat ramp="review"  icon="done"    value={learnedCount} label="کلمه یاد گرفته" />
          <Stat ramp="lessons" icon="lessons" value={progress?.lessons.filter(l => l.completed).length ?? 0} label="درس تمام شده" />
          <Stat ramp="stories" icon="stories" value={progress?.stories.filter(s => s.completed).length ?? 0} label="داستان خوانده" />
        </div>

        {/* Sticky tabs */}
        <div
          className="sticky top-0 z-10 bg-parent-bg border-b border-slate-200 flex gap-1 px-4 pt-3 pb-0 overflow-x-auto"
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
              style={tab === t.key ? { borderColor: 'var(--ramp-brand-bright)' } : undefined}
              className={`flex-shrink-0 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-colors border-b-2 ${
                tab === t.key
                  ? 'bg-parent-surface text-parent-text'
                  : 'border-transparent text-parent-muted hover:text-parent-text'
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
                <p className="text-center text-parent-muted py-8 persian-text">هنوز کلمه‌ای یاد نگرفته</p>
              )}
              {MASTERY_ORDER.map(level =>
                wordsByMastery[level].length > 0 && (
                  <section key={level} aria-labelledby={`mastery-${level}`}>
                    <h3 id={`mastery-${level}`} className="text-sm font-bold text-parent-text mb-2 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${MASTERY_COLOR[level]}`}>{MASTERY_LABEL[level]}</span>
                      <span className="text-parent-muted font-normal">{wordsByMastery[level].length} کلمه</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {wordsByMastery[level].map(w => (
                        <div key={w.id} className={`px-3 py-1.5 rounded-xl text-sm font-medium ${MASTERY_COLOR[level]}`}>
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
                <p className="text-center text-parent-muted py-8 persian-text">هنوز درسی شروع نشده</p>
              )}
              {progress?.lessons.map(l => (
                <Panel key={l.id} className="flex items-center gap-4">
                  <span className={l.completed ? 'text-emerald-700' : 'text-parent-muted'}><Icon name={l.completed ? 'doneCircle' : 'time'} size="lg" /></span>
                  <div className="flex-1">
                    <p className="font-medium text-parent-text">{l.lesson?.title ?? '—'}</p>
                    {l.completed && l.completed_at && (
                      <p className="text-xs text-parent-muted mt-0.5">
                        {new Date(l.completed_at).toLocaleDateString('fa-IR')}
                        {l.score != null && ` · نمره: ${l.score}٪`}
                      </p>
                    )}
                  </div>
                </Panel>
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
                <p className="text-center text-parent-muted py-8 persian-text">هنوز داستانی خوانده نشده</p>
              )}
              {progress?.stories.map(s => (
                <Panel key={s.id} className="flex items-center gap-4">
                  <span className={s.completed ? 'text-emerald-700' : 'text-parent-muted'}><Icon name={s.completed ? 'stories' : 'report'} size="lg" /></span>
                  <div className="flex-1">
                    <p className="font-medium text-parent-text">{s.story?.title_persian ?? '—'}</p>
                    <p className="text-xs text-parent-muted mt-0.5">
                      {s.completed ? 'خوانده شده' : `صفحه ${s.last_page}`}
                      {s.replay_count > 0 && ` · ${s.replay_count} بار تکرار`}
                      {` · ${new Date(s.last_read_at).toLocaleDateString('fa-IR')}`}
                    </p>
                  </div>
                </Panel>
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
                <p className="text-center text-parent-muted py-8 persian-text">هنوز جلسه‌ای ثبت نشده</p>
              )}
              {progress?.recent_sessions.map((s, i) => (
                <Panel key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-parent-muted"><Icon name="calendar" size="md" /></span>
                    <span className="text-parent-text">{new Date(s.started_at).toLocaleDateString('fa-IR')}</span>
                  </div>
                  <span className="text-sm text-parent-muted">
                    {s.duration_sec ? `${Math.round(s.duration_sec / 60)} دقیقه` : '—'}
                  </span>
                </Panel>
              ))}
            </div>
          </div>
        </div>
      </div>
  )
}
