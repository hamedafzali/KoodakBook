import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Lesson } from '@koodakbook/shared'
import { LESSON_TYPE_EMOJI, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'

export default function Lessons() {
  const insets = useSafeAreaInsets()
  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        if (!childId) { router.replace('/children'); return }
        const [lessonsRes, progRes] = await Promise.all([
          api.get<Lesson[]>('/api/lessons'),
          api.get<{ lessons: { lesson_id: string; completed: boolean }[] }>(`/api/progress/${childId}`),
        ])
        if (cancelled) return
        if (lessonsRes.data) setLessons(lessonsRes.data)
        else setError(lessonsRes.error)
        if (progRes.data) {
          setCompleted(new Set(progRes.data.lessons.filter((l) => l.completed).map((l) => l.lesson_id)))
        }
      }
      load()
      return () => { cancelled = true }
    }, [])
  )

  if (!lessons) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
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
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>هنوز درسی نیست</Text>}
        renderItem={({ item }) => {
          const done = completed.has(item.id)
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/lesson/${item.id}`)}>
              <Text style={styles.emoji}>{LESSON_TYPE_EMOJI[item.type] ?? '📚'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.lessonTitle}>{item.title}</Text>
                {item.description && <Text style={styles.description} numberOfLines={1}>{item.description}</Text>}
              </View>
              {done && <Text style={styles.done}>✅</Text>}
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  empty: { color: colors.muted, fontFamily: fonts.regular, textAlign: 'center', marginTop: 60 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: 18, padding: 16,
  },
  emoji: { fontSize: 32 },
  lessonTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  description: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  done: { fontSize: 18 },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
