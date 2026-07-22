import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import type { Badge, Promotion, SceneSlug, SceneTime, Story, StoryPage } from '@koodakbook/shared'
import { parseSceneRef, toPersianDigits } from '@koodakbook/shared'
import RewardPopup from '@/components/RewardPopup'
import SceneBackdrop from '@/components/SceneBackdrop'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import { getTranslationLang } from '@/lib/prefs'
import { colors, fonts } from '@/lib/theme'

type FullStory = Story & { pages: StoryPage[] }

export default function StoryReader() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [story, setStory] = useState<FullStory | null>(null)
  const [childId, setChildId] = useState<string | null>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [newBadge, setNewBadge] = useState<Badge | null>(null)
  const [showUnlock, setShowUnlock] = useState(false)

  // One player per page, created lazily and kept for the whole visit — the
  // next page's player is created ahead of time so page-turn voice is instant
  // (mirrors web's prefetch in StoryReader).
  const playersRef = useRef<Map<string, AudioPlayer>>(new Map())
  // Bumped whenever the intended clip changes (page turn / leaving), so a clip
  // that finishes loading late doesn't start playing over a newer page.
  const playGenRef = useRef(0)

  const getPlayer = useCallback((page: StoryPage): AudioPlayer | null => {
    const uri = mediaUrl(page.audio_url)
    if (!uri) return null
    let p = playersRef.current.get(page.id)
    if (!p) {
      p = createAudioPlayer({ uri })
      playersRef.current.set(page.id, p)
    }
    return p
  }, [])

  // Restart a page's clip from the top. The source loads asynchronously, so
  // play immediately if it's ready, otherwise the moment loading completes —
  // calling play() before the clip has loaded is a silent no-op.
  function playFromStart(player: AudioPlayer) {
    const gen = ++playGenRef.current
    const go = () => {
      if (gen !== playGenRef.current) return
      try { player.seekTo(0) } catch { /* not seekable yet */ }
      player.play()
    }
    if (player.isLoaded) { go(); return }
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (gen !== playGenRef.current) { sub.remove(); return }
      if (status.isLoaded) { go(); sub.remove() }
    })
  }

  // Backdrop per page from scene_plan; a page without one inherits the previous
  // page's scene, and the story falls back to a friendly default (web parity).
  const scenes = useMemo<{ scene: SceneSlug; time: SceneTime }[]>(() => {
    let last: { scene: SceneSlug; time: SceneTime } = { scene: 'park', time: 'day' }
    return (story?.pages ?? []).map((pg) => {
      const ref = parseSceneRef(pg.scene_plan?.scene, pg.scene_plan?.time)
      if (ref) last = ref
      return last
    })
  }, [story])

  useEffect(() => {
    getActiveChildId().then(setChildId)
    // ?lang attaches the family's translation per page (settings → زبان ترجمه).
    const lang = getTranslationLang()
    api.get<FullStory>(`/api/stories/${id}?lang=${lang}`).then((res) => {
      if (res.data) setStory(res.data)
      else setError(res.error)
    })
  }, [id])

  // Self-heal: an AI story (created for this child) with any silent page builds
  // its own audio (free Piper), then we refetch so بشنو plays — no manual step.
  // In the premium plan this happens at generation time; this is the fallback.
  useEffect(() => {
    if (!story) return
    const isAi = !!(story as { created_for_child?: string | null }).created_for_child
    if (!isAi || !story.pages.some((p) => !p.audio_url)) return
    let cancelled = false
    api.post(`/api/ai/stories/${story.id}/audio`, {})
      .then(async () => {
        if (cancelled) return
        const r = await api.get<FullStory>(`/api/stories/${story.id}?lang=${getTranslationLang()}`)
        if (r.data && !cancelled) setStory(r.data)
      })
      .catch(() => { /* leave text-only; nothing breaks */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id])

  // Autoplay the current page's clip and warm the next page's player.
  useEffect(() => {
    if (!story) return
    const page = story.pages[pageIdx]
    if (!page) return
    const player = getPlayer(page)
    if (player) playFromStart(player)
    const next = story.pages[pageIdx + 1]
    if (next) getPlayer(next)
    return () => { playGenRef.current++; player?.pause() }
  }, [story, pageIdx, getPlayer])

  // Release every native player when leaving the story.
  useEffect(() => {
    const players = playersRef.current
    return () => { players.forEach((p) => p.release()) }
  }, [])

  function replay() {
    if (!story) return
    const player = getPlayer(story.pages[pageIdx])
    if (player) playFromStart(player)
  }

  function goTo(idx: number) {
    setPageIdx(idx)
    // Fire-and-forget: losing one progress ping must never block a page turn.
    if (childId && story) {
      void api.post('/api/progress/story', { child_id: childId, story_id: story.id, last_page: idx })
    }
  }

  async function finish() {
    if (!childId || !story) { router.back(); return }
    try {
      // new_badges / promotions are top-level on the response, not under `data`
      // (same contract web's reader relies on).
      const res = await api.post('/api/progress/story', {
        child_id: childId, story_id: story.id, last_page: story.pages.length - 1, completed: true,
      }) as { new_badges?: Badge[]; promotions?: Promotion[] }
      if (res.new_badges?.[0]) { setNewBadge(res.new_badges[0]); return }
      if (res.promotions?.length) {
        setShowUnlock(true)
        setTimeout(() => router.back(), 2600)
        return
      }
    } catch { /* never leave the child stuck on the last page */ }
    router.back()
  }

  if (!story) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  if (showUnlock) {
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 44 }}>🔓✨</Text>
        <Text style={styles.unlockTitle}>محتوای جدید باز شد!</Text>
        <Text style={styles.unlockSub}>داستان‌ها و درس‌های تازه منتظرت هستند</Text>
      </View>
    )
  }

  const page = story.pages[pageIdx]
  const hasAudio = !!(page && mediaUrl(page.audio_url))
  const isLast = pageIdx === story.pages.length - 1

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {newBadge && <RewardPopup badge={newBadge} onClose={() => router.back()} />}

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
        {/* A real page image wins; otherwise the scene library paints the page. */}
        {page && mediaUrl(page.image_url) ? (
          <Image
            source={{ uri: mediaUrl(page.image_url)! }}
            style={styles.pageImage}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <SceneBackdrop
            scene={scenes[pageIdx]?.scene ?? 'park'}
            time={scenes[pageIdx]?.time ?? 'day'}
            style={styles.pageImage}
          />
        )}
        {page && <Text style={styles.pageText}>{page.text_persian}</Text>}
        {page?.translation ? <Text style={styles.pageTranslation}>{page.translation}</Text> : null}
        {hasAudio && (
          <Pressable style={styles.audioButton} onPress={replay} hitSlop={8}>
            <Text style={styles.audioButtonText}>🔊 بشنو</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.nav, { paddingBottom: insets.bottom + 16 }]}>
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
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
  close: { fontSize: 20, color: colors.muted },
  storyTitle: { flex: 1, fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  pageCount: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted },
  pageContent: { padding: 20, gap: 18, alignItems: 'center' },
  pageImage: { width: '100%', height: 260, borderRadius: 16, backgroundColor: colors.card },
  pageText: {
    fontSize: 22, lineHeight: 44, fontFamily: fonts.medium, color: colors.text,
    textAlign: 'center', writingDirection: 'rtl',
  },
  pageTranslation: {
    fontSize: 15, lineHeight: 26, fontFamily: fonts.regular, color: colors.muted,
    textAlign: 'center', writingDirection: 'ltr',
  },
  audioButton: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22 },
  audioButtonText: { color: colors.primary, fontSize: 16, fontFamily: fonts.medium },
  nav: { flexDirection: 'row', gap: 12, padding: 20 },
  navButton: {
    flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.card,
  },
  nextButton: { backgroundColor: colors.primary },
  finishButton: { backgroundColor: colors.success },
  navDisabled: { opacity: 0.4 },
  navText: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  unlockTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  unlockSub: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
