import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import type { Story, StoryPage } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import { colors } from '@/lib/theme'

type FullStory = Story & { pages: StoryPage[] }

/**
 * One player per page, remounted via key={page.id} so each page turn gets a
 * fresh player that autoplays its clip and is released on unmount.
 */
function PageAudio({ uri }: { uri: string }) {
  const player = useAudioPlayer({ uri })
  const status = useAudioPlayerStatus(player)

  useEffect(() => {
    player.play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function replay() {
    player.seekTo(0)
    player.play()
  }

  return (
    <Pressable style={styles.audioButton} onPress={replay} hitSlop={8}>
      <Text style={styles.audioButtonText}>{status.playing ? '🔊 در حال پخش…' : '🔊 بشنو'}</Text>
    </Pressable>
  )
}

export default function StoryReader() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [story, setStory] = useState<FullStory | null>(null)
  const [childId, setChildId] = useState<string | null>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getActiveChildId().then(setChildId)
    api.get<FullStory>(`/api/stories/${id}`).then((res) => {
      if (res.data) setStory(res.data)
      else setError(res.error)
    })
  }, [id])

  function goTo(idx: number) {
    setPageIdx(idx)
    // Fire-and-forget: losing one progress ping must never block a page turn.
    if (childId && story) {
      void api.post('/api/progress/story', { child_id: childId, story_id: story.id, last_page: idx })
    }
  }

  async function finish() {
    if (childId && story) {
      await api.post('/api/progress/story', {
        child_id: childId, story_id: story.id, last_page: story.pages.length - 1, completed: true,
      })
    }
    router.back()
  }

  if (!story) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  const page = story.pages[pageIdx]
  const audioUri = mediaUrl(page?.audio_url)
  const isLast = pageIdx === story.pages.length - 1

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.storyTitle} numberOfLines={1}>{story.title_persian}</Text>
        <Text style={styles.pageCount}>
          {toPersianDigits(pageIdx + 1)} / {toPersianDigits(story.pages.length)}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.pageContent}>
        {page && mediaUrl(page.image_url) && (
          <Image
            source={{ uri: mediaUrl(page.image_url)! }}
            style={styles.pageImage}
            contentFit="contain"
            transition={150}
          />
        )}
        {page && <Text style={styles.pageText}>{page.text_persian}</Text>}
        {audioUri && page && <PageAudio key={page.id} uri={audioUri} />}
      </ScrollView>

      <View style={styles.nav}>
        <Pressable
          style={[styles.navButton, pageIdx === 0 && styles.navDisabled]}
          disabled={pageIdx === 0}
          onPress={() => goTo(pageIdx - 1)}
        >
          <Text style={styles.navText}>قبلی</Text>
        </Pressable>
        {isLast ? (
          <Pressable style={[styles.navButton, styles.finishButton]} onPress={finish}>
            <Text style={[styles.navText, { color: '#fff' }]}>تمام شد 🎉</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.navButton, styles.nextButton]} onPress={() => goTo(pageIdx + 1)}>
            <Text style={[styles.navText, { color: '#fff' }]}>بعدی</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
  close: { fontSize: 20, color: colors.muted },
  storyTitle: { flex: 1, fontSize: 17, fontWeight: 'bold', color: colors.text },
  pageCount: { fontSize: 14, color: colors.muted },
  pageContent: { padding: 20, gap: 18, alignItems: 'center' },
  pageImage: { width: '100%', height: 260, borderRadius: 16, backgroundColor: colors.card },
  pageText: { fontSize: 22, lineHeight: 40, color: colors.text, textAlign: 'center', writingDirection: 'rtl' },
  audioButton: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22 },
  audioButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  nav: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 36 },
  navButton: {
    flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.card,
  },
  nextButton: { backgroundColor: colors.primary },
  finishButton: { backgroundColor: colors.success },
  navDisabled: { opacity: 0.4 },
  navText: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  error: { color: colors.danger },
})
