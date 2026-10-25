import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type {
  Child, ChildLessonProgress, ChildSession, ChildStoryProgress, ChildWordProgress,
  Lesson, Story, Word,
} from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { Ionicons } from '@expo/vector-icons'
import ParentLoadState, { PARENT_FALLBACK_ERROR } from '@/components/ParentLoadState'
import { ParentHeader, ParentPage, parentUI } from '@/components/ParentUI'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { isParentUnlocked } from '@/lib/parentGate'
import { fonts, radii, ramps, spacing, textSize, textStart, ui } from '@/lib/theme'

interface RawProgress {
  words: ChildWordProgress[]
  lessons: ChildLessonProgress[]
  stories: ChildStoryProgress[]
  recent_sessions: ChildSession[]
}

const MASTERY_ORDER = ['consolidated', 'mastered', 'practicing', 'introduced'] as const
type MasteryKey = typeof MASTERY_ORDER[number]

// The same four colours as the hub's «وضعیت کلمه‌ها» dots (parent/index.tsx):
// each ramp's soft fill with its ink (>=7:1 on the soft, tools/design/ramps.py).
const MASTERY_TINT: Record<MasteryKey, { bg: string; fg: string }> = {
  consolidated: { bg: ramps.letters.soft, fg: ramps.letters.ink },
  mastered: { bg: ramps.lessons.soft, fg: ramps.lessons.ink },
  practicing: { bg: ramps.brand.soft, fg: ramps.brand.ink },
  introduced: { bg: parentUI.field, fg: ui.textMuted },
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
  // The child picked on the parent hub (?child=<id>). Without it (an older
  // link) this falls back to the device's active child, as before.
  const { child: childParam } = useLocalSearchParams<{ child?: string }>()
  const allowed = isParentUnlocked()
  const [child, setChild] = useState<Child | null>(null)
  const [data, setData] = useState<Enriched | null>(null)
  const [tab, setTab] = useState<TabKey>('words')
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }

  // A deep link straight here must face the PIN like the hub does.
  useFocusEffect(useCallback(() => {
    if (!isParentUnlocked()) router.replace('/parent')
  }, []))

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    async function load() {
      const childId = childParam || await getActiveChildId().catch(() => null)
      if (cancelled) return
      const childRes = await api.get<Child[]>('/api/children')
      if (cancelled) return
      if (!childRes.data) { setError(childRes.error || PARENT_FALLBACK_ERROR); return }
      const c = childRes.data.find((x) => x.id === childId) ?? childRes.data[0] ?? null
      setChild(c)
      if (!c) { setError('پروفایل کودک یافت نشد'); return }
      const [progRes, wordsRes, lessonsRes, storiesRes] = await Promise.all([
        api.get<RawProgress>(`/api/progress/${c.id}`),
        api.get<Word[]>('/api/words'),
        api.get<Lesson[]>('/api/lessons'),
        api.get<Story[]>('/api/stories'),
      ])
      if (cancelled) return
      if (!progRes.data) { setError(progRes.error || PARENT_FALLBACK_ERROR); return }
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
    return () => { cancelled = true }
  }, [allowed, childParam, reloadKey])

  const wordsByMastery = useMemo(() => {
    const groups = { consolidated: [], mastered: [], practicing: [], introduced: [] } as Record<MasteryKey, Enriched['words']>
    for (const w of data?.words ?? []) groups[effectiveMastery(w)].push(w)
    return groups
  }, [data])

  if (!allowed) return <View style={styles.center} />
  if (!data) {
    return <ParentLoadState title={child ? `پیشرفت ${child.name}` : 'پیشرفت'} subtitle="گزارش کامل یادگیری" error={error} onRetry={error === 'پروفایل کودک یافت نشد' ? undefined : retry} />
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
    <ParentPage>
      <ParentHeader title={`پیشرفت ${child?.name ?? ''}`} subtitle="گزارش کامل یادگیری" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
        stickyHeaderIndices={[1]}
      >

      <View style={styles.statsRow}>
        <Stat value={learnedCount} label="کلمه یاد گرفته" bg={ramps.lessons.soft} fg={ramps.lessons.ink} />
        <Stat value={lessonsDone} label="درس تمام شده" bg={ramps.brand.soft} fg={ramps.brand.ink} />
        <Stat value={storiesDone} label="داستان خوانده" bg={ramps.letters.soft} fg={ramps.letters.ink} />
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}
            accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
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
              <Ionicons name={l.completed ? 'checkmark-circle' : 'time-outline'} size={22} color={l.completed ? ui.success : ui.textMuted} />
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
              <Ionicons name={s.completed ? 'book' : 'document-outline'} size={22} color={s.completed ? ui.success : ui.textMuted} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={16} color={parentUI.text} />
                <Text style={styles.listTitle}>{new Date(s.started_at).toLocaleDateString('fa-IR')}</Text>
              </View>
              <Text style={styles.listMeta}>
                {s.duration_sec ? `${toPersianDigits(Math.round(s.duration_sec / 60))} دقیقه` : '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
      </ScrollView>
    </ParentPage>
  )
}

function Stat({ value, label, bg, fg }: { value: number; label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: bg }]} accessible accessibilityLabel={`${label}: ${toPersianDigits(value)}`}>
      <Text style={[styles.statValue, { color: fg }]}>{toPersianDigits(value)}</Text>
      <Text style={[styles.statLabel, { color: fg }]}>{label}</Text>
    </View>
  )
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: parentUI.page },
  content: { paddingHorizontal: spacing.md + 4, gap: spacing.md - 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm + 2 },
  stat: { flex: 1, borderRadius: parentUI.radius, padding: spacing.md - 2, alignItems: 'center', gap: 2 },
  statValue: { fontSize: textSize.h2, fontFamily: fonts.bold },
  statLabel: { fontSize: textSize.micro, fontFamily: fonts.medium, textAlign: 'center' },
  // Sticky under the header: the page's own colour so rows scroll under it.
  tabs: { flexDirection: 'row', gap: 6, backgroundColor: parentUI.page, paddingVertical: 6 },
  tab: {
    flex: 1, minHeight: ui.hit, paddingHorizontal: 2, borderRadius: parentUI.controlRadius,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: parentUI.surface, borderWidth: 1, borderColor: parentUI.line,
  },
  tabActive: { backgroundColor: parentUI.accentSoft, borderColor: parentUI.accent },
  tabText: { fontSize: textSize.micro + 1, fontFamily: fonts.medium, color: parentUI.muted, textAlign: 'center' },
  tabTextActive: { fontFamily: fonts.bold, color: parentUI.accentText },
  masteryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  masteryPill: { borderRadius: radii.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3 },
  masteryPillText: { fontSize: textSize.micro + 1, fontFamily: fonts.bold },
  masteryCount: { fontSize: textSize.micro + 1, fontFamily: fonts.regular, color: parentUI.muted },
  wordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  wordChip: { borderRadius: parentUI.controlRadius, paddingHorizontal: spacing.sm + 4, paddingVertical: 6 },
  wordChipText: { fontSize: textSize.caption + 1, fontFamily: fonts.medium },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, backgroundColor: parentUI.surface,
    borderRadius: parentUI.controlRadius + 2, borderWidth: 1, borderColor: parentUI.line, padding: spacing.md - 2,
  },
  listTitle: { fontSize: textSize.caption + 1, fontFamily: fonts.medium, color: parentUI.text, textAlign: textStart },
  listMeta: { fontSize: textSize.micro + 1, fontFamily: fonts.regular, color: parentUI.muted, marginTop: 2, textAlign: textStart },
  empty: { textAlign: 'center', color: parentUI.muted, fontFamily: fonts.regular, fontSize: textSize.caption + 1, paddingVertical: spacing.xl - 2 },
})
