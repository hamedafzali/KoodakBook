import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { SceneSlug, Story } from '@koodakbook/shared'
import { SCENE_SLUGS, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import SceneBackdrop from '@/components/SceneBackdrop'
import { colors, fonts } from '@/lib/theme'

/** Deterministic illustrated cover per story id (web parity for coverless stories). */
function sceneFor(id: string): SceneSlug {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SCENE_SLUGS[h % SCENE_SLUGS.length]
}

export default function Stories() {
  const insets = useSafeAreaInsets()
  const [stories, setStories] = useState<Story[] | null>(null)
  const [myStories, setMyStories] = useState<Story[]>([])   // child's own AI stories
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Refetch on focus so «خوندم» badges appear right after finishing a story.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        if (!childId) { router.replace('/children'); return }
        const [storiesRes, progRes, mineRes] = await Promise.all([
          api.get<Story[]>('/api/stories'),
          api.get<{ stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${childId}`),
          api.get<Story[]>(`/api/ai/stories/${childId}`),
        ])
        if (cancelled) return
        if (storiesRes.data) setStories(storiesRes.data)
        else setError(storiesRes.error)
        if (progRes.data) {
          setCompleted(new Set(progRes.data.stories.filter((s) => s.completed).map((s) => s.story_id)))
        }
        if (mineRes.data) setMyStories(mineRes.data)
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

  function card(story: Story, isMine: boolean) {
    const done = completed.has(story.id)
    const cover = mediaUrl(story.cover_url)
    return (
      <Pressable key={story.id} style={styles.card} onPress={() => router.push(`/story/${story.id}`)}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
        ) : (
          <SceneBackdrop scene={sceneFor(story.id)} style={styles.cover} />
        )}
        {done && (
          <View style={styles.doneBadge}>
            <Text style={styles.doneText}>✅ خوندم</Text>
          </View>
        )}
        {isMine && (
          <View style={styles.mineBadge}>
            <Text style={styles.mineBadgeText}>✨ مال من</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.storyTitle} numberOfLines={2}>{story.title_persian}</Text>
          {!isMine && story.age_min != null && (
            <Text style={styles.age}>
              {toPersianDigits(story.age_min)}–{toPersianDigits(story.age_max ?? story.age_min)} سال
            </Text>
          )}
        </View>
      </Pressable>
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

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable style={styles.createButton} onPress={() => router.push('/story/new')}>
          <Text style={{ fontSize: 26 }}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.createTitle}>یک داستان برای من بساز</Text>
            <Text style={styles.createSub}>داستان مخصوص خودت با موضوع دلخواه</Text>
          </View>
          <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
        </Pressable>

        {myStories.length > 0 && (
          <>
            <Text style={styles.section}>داستان‌های من ✨</Text>
            <View style={styles.grid}>{myStories.map((s) => card(s, true))}</View>
          </>
        )}

        {myStories.length > 0 && stories.length > 0 && (
          <Text style={styles.section}>داستان‌های آماده 📚</Text>
        )}
        {stories.length === 0 ? (
          <Text style={styles.empty}>هنوز داستانی نیست</Text>
        ) : (
          <View style={styles.grid}>{stories.map((s) => card(s, false))}</View>
        )}
      </ScrollView>
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
  body: { paddingHorizontal: 16, gap: 12 },
  createButton: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#a21caf', borderRadius: 20, padding: 16,
  },
  createTitle: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
  createSub: { fontSize: 11, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  section: { fontSize: 16, fontFamily: fonts.bold, color: colors.text, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  empty: { color: colors.muted, fontFamily: fonts.regular, textAlign: 'center', marginTop: 40 },
  card: { width: '48%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' },
  cover: { width: '100%', height: 120 },
  doneBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: colors.success,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  doneText: { color: '#fff', fontSize: 11, fontFamily: fonts.medium },
  mineBadge: {
    position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(162,28,175,0.9)',
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  mineBadgeText: { color: '#fff', fontSize: 11, fontFamily: fonts.medium },
  cardBody: { padding: 10, gap: 4 },
  storyTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, lineHeight: 20 },
  age: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
