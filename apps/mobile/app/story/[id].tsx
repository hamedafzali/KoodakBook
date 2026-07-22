import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer, type AudioStatus } from 'expo-audio'
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

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return toPersianDigits(`${m}:${String(s).padStart(2, '0')}`)
}

export default function StoryReader() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [story, setStory] = useState<FullStory | null>(null)
  const [childId, setChildId] = useState<string | null>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [newBadge, setNewBadge] = useState<Badge | null>(null)
  const [showUnlock, setShowUnlock] = useState(false)

  // The current page's audio. useAudioPlayer recreates (and releases the old)
  // when the URI changes, so page turns swap the clip and lifecycle is managed
  // for us — no manual player bookkeeping (which was crashing).
  const page = story?.pages[pageIdx]
  const audioUri = page ? mediaUrl(page.audio_url) : null
  const player = useAudioPlayer(audioUri ?? undefined)
  const status = useAudioPlayerStatus(player)

  // Autoplay each page's clip once it has loaded (playing before load no-ops).
  const playedUriRef = useRef<string | null>(null)
  useEffect(() => {
    if (!audioUri) return
    if (status.isLoaded && playedUriRef.current !== audioUri) {
      playedUriRef.current = audioUri
      try { player.seekTo(0); player.play() } catch { /* not ready */ }
    }
  }, [audioUri, status.isLoaded, player])

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
    const lang = getTranslationLang()
    api.get<FullStory>(`/api/stories/${id}?lang=${lang}`).then((res) => {
      if (res.data) setStory(res.data)
      else setError(res.error)
    })
  }, [id])

  // Self-heal: an AI story with any silent page builds its own audio, then we
  // refetch so it plays — no manual step (premium builds it at generation time).
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
      .catch(() => { /* leave text-only */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id])

  function goTo(idx: number) {
    setPageIdx(idx)
    if (childId && story) {
      void api.post('/api/progress/story', { child_id: childId, story_id: story.id, last_page: idx })
    }
  }

  async function finish() {
    if (!childId || !story) { router.back(); return }
    try {
      const res = await api.post('/api/progress/story', {
        child_id: childId, story_id: story.id, last_page: story.pages.length - 1, completed: true,
      }) as { new_badges?: Badge[]; promotions?: Promotion[] }
      if (res.new_badges?.[0]) { setNewBadge(res.new_badges[0]); return }
      if (res.promotions?.length) {
        setShowUnlock(true)
        setTimeout(() => router.back(), 2600)
        return
      }
    } catch { /* never leave the child stuck */ }
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
        {page && mediaUrl(page.image_url) ? (
          <Image source={{ uri: mediaUrl(page.image_url)! }} style={styles.pageImage} contentFit="contain" transition={150} />
        ) : (
          <SceneBackdrop scene={scenes[pageIdx]?.scene ?? 'park'} time={scenes[pageIdx]?.time ?? 'day'} style={styles.pageImage} />
        )}
        {page && <Text style={styles.pageText}>{page.text_persian}</Text>}
        {page?.translation ? <Text style={styles.pageTranslation}>{page.translation}</Text> : null}
        {audioUri && <AudioBar player={player} status={status} />}
      </ScrollView>

      <View style={[styles.nav, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={[styles.navButton, pageIdx === 0 && styles.navDisabled]} disabled={pageIdx === 0} onPress={() => goTo(pageIdx - 1)}>
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

/** Play/pause + seekable progress + time, so the child (and we) can see the
 *  voice status: buffering, playing position, and duration. */
function AudioBar({ player, status }: { player: AudioPlayer; status: AudioStatus }) {
  const [trackW, setTrackW] = useState(0)
  const dur = status.duration || 0
  const cur = Math.min(status.currentTime || 0, dur || Infinity)
  const frac = dur > 0 ? Math.max(0, Math.min(1, cur / dur)) : 0
  const loading = !status.isLoaded || status.isBuffering

  function toggle() {
    try {
      if (status.playing) player.pause()
      else {
        if (dur > 0 && cur >= dur - 0.05) player.seekTo(0)
        player.play()
      }
    } catch { /* not ready */ }
  }

  function seek(e: GestureResponderEvent) {
    if (!trackW || dur <= 0) return
    const f = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackW))
    try { player.seekTo(f * dur) } catch { /* not ready */ }
  }

  return (
    <View style={styles.audioBar}>
      <Pressable style={styles.playButton} onPress={toggle} hitSlop={6}>
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.playIcon}>{status.playing ? '⏸' : '▶'}</Text>}
      </Pressable>
      <View style={{ flex: 1, gap: 5 }}>
        <Pressable onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)} onPress={seek} hitSlop={10} style={styles.track}>
          <View style={[styles.trackFill, { width: `${frac * 100}%` }]} />
          <View style={[styles.knob, { left: `${frac * 100}%` }]} />
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmtTime(cur)}</Text>
          <Text style={styles.time}>{loading ? 'در حال بارگذاری…' : fmtTime(dur)}</Text>
        </View>
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
  audioBar: {
    flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%',
    backgroundColor: colors.card, borderRadius: 20, padding: 14,
  },
  playButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 20 },
  track: { height: 8, borderRadius: 999, backgroundColor: '#e5e7eb', justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary, borderRadius: 999 },
  knob: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, marginLeft: -8, top: -4 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
  nav: { flexDirection: 'row', gap: 12, padding: 20 },
  navButton: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.card },
  nextButton: { backgroundColor: colors.primary },
  finishButton: { backgroundColor: colors.success },
  navDisabled: { opacity: 0.4 },
  navText: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  unlockTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  unlockSub: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
