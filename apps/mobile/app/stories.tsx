import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Story } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import { downloadStory, listDownloadedIds, listDownloadedStories, type FullStory } from '@/lib/offline'
import { colors, fonts } from '@/lib/theme'

export default function Stories() {
  const insets = useSafeAreaInsets()
  const [stories, setStories] = useState<Story[] | null>(null)
  const [myStories, setMyStories] = useState<Story[]>([])   // child's own AI stories
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [voicing, setVoicing] = useState<Set<string>>(new Set())
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refetch on focus so «خوندم» badges appear right after finishing a story.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        if (!childId) { router.replace('/children'); return }
        const [storiesRes, progRes, mineRes, downloadedIds] = await Promise.all([
          api.get<Story[]>('/api/stories'),
          api.get<{ stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${childId}`),
          api.get<Story[]>(`/api/ai/stories/${childId}`),
          listDownloadedIds(),
        ])
        if (cancelled) return
        setDownloaded(new Set(downloadedIds))
        if (storiesRes.data) {
          setStories(storiesRes.data)
          setOffline(false)
        } else {
          // No network — fall back to the downloaded packs as the catalogue.
          const packs = await listDownloadedStories()
          if (cancelled) return
          if (packs.length) { setStories(packs); setOffline(true) }
          else setError(storiesRes.error)
        }
        if (progRes.data) {
          setCompleted(new Set(progRes.data.stories.filter((s) => s.completed).map((s) => s.story_id)))
        }
        if (mineRes.data) setMyStories(mineRes.data)
      }
      load()
      return () => { cancelled = true }
    }, [])
  )

  async function download(id: string) {
    if (downloading.has(id) || downloaded.has(id)) return
    setDownloading((s) => new Set(s).add(id))
    const res = await api.get<FullStory>(`/api/stories/${id}`)
    if (res.data) {
      await downloadStory(res.data)
      setDownloaded((s) => new Set(s).add(id))
    }
    setDownloading((s) => { const n = new Set(s); n.delete(id); return n })
  }

  async function makeVoice(id: string) {
    setVoicing((s) => new Set(s).add(id))
    await api.post(`/api/ai/stories/${id}/audio`, {})
    setVoicing((s) => { const n = new Set(s); n.delete(id); return n })
  }

  if (!stories) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  function card(story: Story, isMine: boolean) {
    const done = completed.has(story.id)
    const busy = voicing.has(story.id)
    const isDownloading = downloading.has(story.id)
    const isDownloaded = downloaded.has(story.id)
    return (
      <View key={story.id} style={styles.card}>
        <Pressable onPress={() => router.push(`/story/${story.id}`)}>
          {mediaUrl(story.cover_url) ? (
            <Image source={{ uri: mediaUrl(story.cover_url)! }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.coverFallback, isMine && { backgroundColor: '#fae8ff' }]}>
              <Text style={{ fontSize: 40 }}>{isMine ? '✨' : '📖'}</Text>
            </View>
          )}
          {done && (
            <View style={styles.doneBadge}>
              <Text style={styles.doneText}>✅ خوندم</Text>
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={styles.storyTitle} numberOfLines={2}>{story.title_persian}</Text>
            {isMine ? (
              <Text style={styles.mine}>داستان من</Text>
            ) : story.age_min != null ? (
              <Text style={styles.age}>
                {toPersianDigits(story.age_min)}–{toPersianDigits(story.age_max ?? story.age_min)} سال
              </Text>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.cardActions}>
          {!offline && (
            <Pressable onPress={() => download(story.id)} disabled={isDownloaded || isDownloading} hitSlop={6}>
              <Text style={styles.action}>
                {isDownloaded ? '📴 آفلاین دارمش' : isDownloading ? '⏳ در حال دریافت…' : '⬇️ آفلاین'}
              </Text>
            </Pressable>
          )}
          {isMine && (
            <Pressable onPress={() => makeVoice(story.id)} disabled={busy} hitSlop={6}>
              <Text style={styles.action}>{busy ? '⏳ در حال ساخت صدا…' : '🔊 ساخت صدا'}</Text>
            </Pressable>
          )}
        </View>
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
          <Text style={styles.subtitle}>
            {offline ? 'حالت آفلاین — فقط دانلود شده‌ها 📴' : `${toPersianDigits(stories.length)} داستان موجود است`}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {!offline && (
          <Pressable style={styles.createButton} onPress={() => router.push('/story/new')}>
            <Text style={{ fontSize: 26 }}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.createTitle}>یک داستان برای من بساز</Text>
              <Text style={styles.createSub}>داستان مخصوص خودت با موضوع دلخواه</Text>
            </View>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
        )}

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
  body: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
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
  coverFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  doneBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: colors.success,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  doneText: { color: '#fff', fontSize: 11, fontFamily: fonts.medium },
  cardBody: { padding: 10, gap: 4 },
  storyTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, lineHeight: 20 },
  age: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
  mine: { fontSize: 11, fontFamily: fonts.medium, color: '#a21caf' },
  cardActions: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  action: { fontSize: 12, fontFamily: fonts.medium, color: colors.primary },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
