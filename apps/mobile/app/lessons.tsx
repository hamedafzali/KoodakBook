import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Lesson, StrandLevels } from '@koodakbook/shared'
import { ALL_UNLOCKED, LESSON_TYPE_EMOJI, isLessonUnlocked, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'
import BottomNav from '@/components/BottomNav'

export default function Lessons() {
  const insets = useSafeAreaInsets()
  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  // Which lessons are actually reachable yet, from the child's placement --
  // web's /child/lesson gates on this (isLessonUnlocked); mobile never did,
  // so a locked lesson was fully tappable (2026-09-20 audit, Critical #1).
  const [strandLevels, setStrandLevels] = useState<StrandLevels>(ALL_UNLOCKED)
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        if (!childId) { router.replace('/children'); return }
        const [lessonsRes, progRes, placeRes] = await Promise.all([
          api.get<Lesson[]>('/api/lessons'),
          api.get<{ lessons: { lesson_id: string; completed: boolean }[] }>(`/api/progress/${childId}`),
          api.get<{ strand_levels: StrandLevels }>(`/api/placement/${childId}`),
        ])
        if (cancelled) return
        if (lessonsRes.data) setLessons(lessonsRes.data)
        else setError(lessonsRes.error)
        if (progRes.data) {
          setCompleted(new Set(progRes.data.lessons.filter((l) => l.completed).map((l) => l.lesson_id)))
        }
        if (placeRes.data?.strand_levels) setStrandLevels(placeRes.data.strand_levels)
      }
      load()
      return () => { cancelled = true }
    }, [])
  )

  if (!lessons) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.onPrimary} />}
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => goBack('/home')} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>درس‌ها 📚</Text>
          <Text style={styles.subtitle}>{toPersianDigits(lessons.length)} درس موجود است</Text>
        </View>
      </View>

      <FlatList
        data={lessons}
        keyExtractor={(l) => l.id}
        contentContainerStyle={[styles.list, { paddingBottom: 92 }]}
        ListEmptyComponent={<Text style={styles.empty}>هنوز درسی نیست</Text>}
        renderItem={({ item }) => {
          const done = completed.has(item.id)
          const locked = !isLessonUnlocked(item, strandLevels)
          if (locked) {
            return (
              <View style={[styles.card, styles.cardLocked]} accessibilityLabel={`${item.title} — قفل شده، مرحله ${item.stage} لازم است`}>
                <View style={[styles.iconWrap, styles.iconWrapLocked]}>
                  <Text style={styles.emoji}>🔒</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lessonTitle, styles.lessonTitleLocked]}>{item.title}</Text>
                  <Text style={styles.lockedReason}>مرحله {toPersianDigits(item.stage)} لازم است</Text>
                </View>
              </View>
            )
          }
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/lesson/${item.id}`)}>
              <View style={[styles.iconWrap, done && styles.iconWrapDone]}>
                <Text style={styles.emoji}>{done ? '✅' : LESSON_TYPE_EMOJI[item.type] ?? '📚'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lessonTitle}>{item.title}</Text>
                {item.description && <Text style={styles.description} numberOfLines={1}>{item.description}</Text>}
              </View>
            </Pressable>
          )
        }}
      />
      <BottomNav current="lessons" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.display, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  empty: { color: colors.muted, fontFamily: fonts.regular, textAlign: 'center', marginTop: 60 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: 18, padding: 16,
  },
  cardLocked: { backgroundColor: 'rgba(255,255,255,0.55)' },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  iconWrapDone: { backgroundColor: colors.successSoft },
  iconWrapLocked: { backgroundColor: colors.borderSoft },
  emoji: { fontSize: 20 },
  lessonTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  lessonTitleLocked: { color: colors.muted },
  lockedReason: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  description: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
