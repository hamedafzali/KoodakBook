import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Story } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import { toPersianDigits } from '@koodakbook/shared'
import { colors, fonts } from '@/lib/theme'

export default function Stories() {
  const insets = useSafeAreaInsets()
  const [stories, setStories] = useState<Story[] | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Refetch on focus so «خوندم» badges appear right after finishing a story.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        if (!childId) { router.replace('/children'); return }
        const [storiesRes, progRes] = await Promise.all([
          api.get<Story[]>('/api/stories'),
          api.get<{ stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${childId}`),
        ])
        if (cancelled) return
        if (storiesRes.data) setStories(storiesRes.data)
        else setError(storiesRes.error)
        if (progRes.data) {
          setCompleted(new Set(progRes.data.stories.filter((s) => s.completed).map((s) => s.story_id)))
        }
      }
      load()
      return () => { cancelled = true }
    }, [])
  )

  if (!stories) {
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
          <Text style={styles.title}>همه داستان‌ها 📖</Text>
          <Text style={styles.subtitle}>{toPersianDigits(stories.length)} داستان موجود است</Text>
        </View>
      </View>

      <FlatList
        data={stories}
        keyExtractor={(s) => s.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<Text style={styles.empty}>هنوز داستانی نیست</Text>}
        renderItem={({ item }) => {
          const done = completed.has(item.id)
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/story/${item.id}`)}>
              {mediaUrl(item.cover_url) ? (
                <Image source={{ uri: mediaUrl(item.cover_url)! }} style={styles.cover} contentFit="cover" />
              ) : (
                <View style={[styles.cover, styles.coverFallback]}>
                  <Text style={{ fontSize: 40 }}>📖</Text>
                </View>
              )}
              {done && (
                <View style={styles.doneBadge}>
                  <Text style={styles.doneText}>✅ خوندم</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.storyTitle} numberOfLines={2}>{item.title_persian}</Text>
                {item.age_min != null && (
                  <Text style={styles.age}>
                    {toPersianDigits(item.age_min)}–{toPersianDigits(item.age_max ?? item.age_min)} سال
                  </Text>
                )}
              </View>
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
  grid: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  empty: { color: colors.muted, fontFamily: fonts.regular, textAlign: 'center', marginTop: 60 },
  card: { flex: 1, backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' },
  cover: { width: '100%', height: 120 },
  coverFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  doneBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: colors.success,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  doneText: { color: '#fff', fontSize: 11, fontFamily: fonts.medium },
  cardBody: { padding: 10, gap: 4 },
  storyTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, lineHeight: 20 },
  age: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
