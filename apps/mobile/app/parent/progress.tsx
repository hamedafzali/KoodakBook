import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type {
  Child, ChildLessonProgress, ChildSession, ChildStoryProgress, ChildWordProgress,
  Lesson, Story, Word,
} from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'

interface RawProgress {
  words: ChildWordProgress[]
  lessons: ChildLessonProgress[]
  stories: ChildStoryProgress[]
  recent_sessions: ChildSession[]
}

const MASTERY_ORDER = ['consolidated', 'mastered', 'practicing', 'introduced'] as const
type MasteryKey = typeof MASTERY_ORDER[number]

const MASTERY_TINT: Record<MasteryKey, { bg: string; fg: string }> = {
  consolidated: { bg: '#d1fae5', fg: '#047857' },
  mastered: { bg: '#dcfce7', fg: '#15803d' },
  practicing: { bg: '#fef3c7', fg: '#b45309' },
  introduced: { bg: '#f1f5f9', fg: '#64748b' },
}
const MASTERY_LABEL: Record<MasteryKey, string> = {
  consolidated: 'تثبیت‌شده', mastered: 'یاد گرفته', practicing: 'در حال تمرین', introduced: 'معرفی شده',
}

function effectiveMastery(w: { mastery?: string; status: string }): MasteryKey {
  if (w.mastery && w.mastery in MASTERY_TINT) return w.mastery as MasteryKey
  if (w.status === 'mastered') return 'mastered'
  if (w.status === 'practiced') return 'practicing'
  return 'introduced'
}

type TabKey = 'words' | 'lessons' | 'stories' | 'sessions'

interface Enriched {
  words: (ChildWordProgress & { word?: Word })[]
  lessons: (ChildLessonProgress & { lesson?: Lesson })[]
  stories: (ChildStoryProgress & { story?: Story })[]
  recent_sessions: ChildSession[]
}

/** Full learning report per child (web: /parent/progress). */
export default function ParentProgress() {
  const insets = useSafeAreaInsets()
  const [child, setChild] = useState<Child | null>(null)
  const [data, setData] = useState<Enriched | null>(null)
  const [tab, setTab] = useState<TabKey>('words')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const childId = await getActiveChildId()
      if (!childId) { router.replace('/children'); return }
      const childRes = await api.get<Child[]>('/api/children')
      const c = childRes.data?.find((x) => x.id === childId) ?? childRes.data?.[0] ?? null
      setChild(c)
      if (!c) { setError('پروفایل کودک یافت نشد'); return }
      const [progRes, wordsRes, lessonsRes, storiesRes] = await Promise.all([
        api.get<RawProgress>(`/api/progress/${c.id}`),
        api.get<Word[]>('/api/words'),
        api.get<Lesson[]>('/api/lessons'),
        api.get<Story[]>('/api/stories'),
      ])
      if (!progRes.data) { setError(progRes.error); return }
      const wordMap = Object.fromEntries((wordsRes.data ?? []).map((w) => [w.id, w]))
      const lessonMap = Object.fromEntries((lessonsRes.data ?? []).map((l) => [l.id, l]))
      const storyMap = Object.fromEntries((storiesRes.data ?? []).map((s) => [s.id, s]))
      setData({
        words: progRes.data.words.map((w) => ({ ...w, word: wordMap[w.word_id] })),
        lessons: progRes.data.lessons.map((l) => ({ ...l, lesson: lessonMap[l.lesson_id] })),
        stories: progRes.data.stories.map((s) => ({ ...s, story: storyMap[s.story_id] })),
        recent_sessions: progRes.data.recent_sessions,
      })
    }
    load()
  }, [])

  const wordsByMastery = useMemo(() => {
    const groups = { consolidated: [], mastered: [], practicing: [], introduced: [] } as Record<MasteryKey, Enriched['words']>
    for (const w of data?.words ?? []) groups[effectiveMastery(w)].push(w)
    return groups
  }, [data])

  if (!data) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  const learnedCount = wordsByMastery.consolidated.length + wordsByMastery.mastered.length
  const lessonsDone = data.lessons.filter((l) => l.completed).length
  const storiesDone = data.stories.filter((s) => s.completed).length

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'words', label: 'کلمات', count: data.words.length },
    { key: 'lessons', label: 'درس‌ها', count: lessonsDone },
    { key: 'stories', label: 'داستان‌ها', count: data.stories.length },
    { key: 'sessions', label: 'جلسات', count: data.recent_sessions.length },
  ]

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      stickyHeaderIndices={[2]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>پیشرفت {child?.name ?? ''}</Text>
          <Text style={styles.subtitle}>گزارش کامل یادگیری</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat value={learnedCount} label="کلمه یاد گرفته" bg="#dcfce7" fg="#15803d" />
        <Stat value={lessonsDone} label="درس تمام شده" bg="#fef3c7" fg="#b45309" />
        <Stat value={storiesDone} label="داستان خوانده" bg="#dbeafe" fg="#1d4ed8" />
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && { color: colors.primary }]}>
              {t.label} ({toPersianDigits(t.count)})
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'words' && (
        <View style={{ gap: 14 }}>
          {data.words.length === 0 && <Empty text="هنوز کلمه‌ای یاد نگرفته" />}
          {MASTERY_ORDER.map((level) =>
            wordsByMastery[level].length > 0 ? (
              <View key={level} style={{ gap: 8 }}>
                <View style={styles.masteryHead}>
                  <View style={[styles.masteryPill, { backgroundColor: MASTERY_TINT[level].bg }]}>
                    <Text style={[styles.masteryPillText, { color: MASTERY_TINT[level].fg }]}>{MASTERY_LABEL[level]}</Text>
                  </View>
                  <Text style={styles.masteryCount}>{toPersianDigits(wordsByMastery[level].length)} کلمه</Text>
                </View>
                <View style={styles.wordWrap}>
                  {wordsByMastery[level].map((w) => (
                    <View key={w.id} style={[styles.wordChip, { backgroundColor: MASTERY_TINT[level].bg }]}>
                      <Text style={[styles.wordChipText, { color: MASTERY_TINT[level].fg }]}>{w.word?.persian ?? '—'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null
          )}
        </View>
      )}

      {tab === 'lessons' && (
        <View style={{ gap: 8 }}>
          {data.lessons.length === 0 && <Empty text="هنوز درسی شروع نشده" />}
          {data.lessons.map((l) => (
            <View key={l.id} style={styles.listRow}>
              <Text style={{ fontSize: 22 }}>{l.completed ? '✅' : '⏳'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{l.lesson?.title ?? '—'}</Text>
                {l.completed && l.score != null && (
                  <Text style={styles.listMeta}>نمره: {toPersianDigits(l.score)}٪</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'stories' && (
        <View style={{ gap: 8 }}>
          {data.stories.length === 0 && <Empty text="هنوز داستانی خوانده نشده" />}
          {data.stories.map((s) => (
            <View key={s.id} style={styles.listRow}>
              <Text style={{ fontSize: 22 }}>{s.completed ? '📖' : '📄'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{s.story?.title_persian ?? '—'}</Text>
                <Text style={styles.listMeta}>
                  {s.completed ? 'خوانده شده' : `صفحه ${toPersianDigits(s.last_page)}`}
                  {s.replay_count > 0 ? ` · ${toPersianDigits(s.replay_count)} بار تکرار` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'sessions' && (
        <View style={{ gap: 8 }}>
          {data.recent_sessions.length === 0 && <Empty text="هنوز جلسه‌ای ثبت نشده" />}
          {data.recent_sessions.map((s, i) => (
            <View key={i} style={[styles.listRow, { justifyContent: 'space-between' }]}>
              <Text style={styles.listTitle}>📅 {new Date(s.started_at).toLocaleDateString('fa-IR')}</Text>
              <Text style={styles.listMeta}>
                {s.duration_sec ? `${toPersianDigits(Math.round(s.duration_sec / 60))} دقیقه` : '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

function Stat({ value, label, bg, fg }: { value: number; label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color: fg }]}>{toPersianDigits(value)}</Text>
      <Text style={[styles.statLabel, { color: fg }]}>{label}</Text>
    </View>
  )
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontFamily: fonts.bold },
  statLabel: { fontSize: 11, fontFamily: fonts.regular, textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 6, backgroundColor: colors.bg, paddingVertical: 6 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center', backgroundColor: colors.card },
  tabActive: { backgroundColor: colors.primarySoft },
  tabText: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted },
  masteryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  masteryPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  masteryPillText: { fontSize: 12, fontFamily: fonts.bold },
  masteryCount: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  wordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordChip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  wordChipText: { fontSize: 14, fontFamily: fonts.medium },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 14 },
  listTitle: { fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  listMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, paddingVertical: 30 },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
