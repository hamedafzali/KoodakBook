import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, I18nManager, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import { Image } from 'expo-image'
import { Icon } from '@/components/Icon'
import CelebrationOverlay from '@/components/CelebrationOverlay'
import { useLocalSearchParams } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer, type AudioStatus } from 'expo-audio'
import type { ApiResponse, Badge, Promotion, SceneSlug, SceneTime, Story, StoryPage, StoryQuestion } from '@koodakbook/shared'
import { parseSceneRef, toPersianDigits } from '@koodakbook/shared'
import RewardPopup from '@/components/RewardPopup'
import SceneBackdrop from '@/components/SceneBackdrop'
import StoryQuiz, { usableQuestions } from '@/components/StoryQuiz'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { localAudio } from '@/lib/audioCache'
import { mediaUrl, thumbUrl } from '@/lib/media'
import { getTranslationLang } from '@/lib/prefs'
import { clay, colors, fonts, naturalLineHeight, radii, ramps, scenery, spacing, textSize, textStart, ui } from '@/lib/theme'
import LoadState from '@/components/LoadState'
import ScreenBackground from '@/components/ScreenBackground'
import { ClayButton, ClayChip, ClaySurface, HostAvatar, ProgressTrack } from '@/components/Clay'
import { GiftBox, Sparkle } from '@/components/Illustrations'

// `questions`: the comprehension quiz (migration 064). The API has always
// returned it on /api/stories/:id; mobile just never read it until Phase 4.
type FullStory = Story & { pages: StoryPage[]; questions?: StoryQuestion[] }

// Right-to-left mark. Android picks a paragraph's direction from its first
// strong character (writingDirection is iOS-only), so a Persian page that
// opens with an English word («Bobo رفت…») was laid out left-to-right there,
// with the Persian words in the wrong order. The mark makes the first strong
// character RTL on both platforms; it is invisible and not spoken.
const RLM = '\u200F'

// Translation languages written right-to-left (shared TRANSLATION_LANGS).
const RTL_LANGS = new Set(['ar'])

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
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }
  const [newBadge, setNewBadge] = useState<Badge | null>(null)
  const [showUnlock, setShowUnlock] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  // A failed completion save used to be treated as done: the reader closed
  // and the story never counted (no «خوندم», no badge). It now stops on
  // «قصه تمام شد، ولی ذخیره نشد» with a retry that re-posts the same
  // completion, and a way back. `retryingSave` keeps that screen on its
  // spinner while the retry runs (error cleared first = no second button).
  const [saveError, setSaveError] = useState<string | null>(null)
  const [retryingSave, setRetryingSave] = useState(false)
  // Image URLs that failed to load this visit. A broken page image fell
  // through to an empty white box; it now falls back like a missing one
  // (page image -> the story's cover -> the scene library).
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(new Set())
  const markFailed = (uri: string) => setFailedImages((s) => (s.has(uri) ? s : new Set(s).add(uri)))

  // The current page's audio. useAudioPlayer recreates (and releases the old)
  // when the URI changes, so page turns swap the clip and lifecycle is managed
  // for us — no manual player bookkeeping (which was crashing).
  const page = story?.pages[pageIdx]
  const audioUri = page ? mediaUrl(page.audio_url) : null
  // Download the clip to a local file, then play that — remote HTTP streaming
  // doesn't reliably load in Expo Go (the bar sat on «در حال بارگذاری»), but a
  // local file plays reliably.
  const [localUri, setLocalUri] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setLocalUri(null)
    if (!audioUri) return
    localAudio(audioUri)
      .then((u) => { if (!cancelled) setLocalUri(u) })
      .catch(() => { if (!cancelled) setLocalUri(audioUri) })   // fall back to streaming
    return () => { cancelled = true }
  }, [audioUri])
  const player = useAudioPlayer(localUri ? { uri: localUri } : undefined)
  const status = useAudioPlayerStatus(player)

  // Autoplay each page's clip once it has loaded (playing before load no-ops).
  const playedUriRef = useRef<string | null>(null)
  // The unlock screen's 2.6s hop back to /stories, cleared on unmount so
  // leaving early doesn't navigate back from whatever screen is next.
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // finish() awaits the completion POST; a child who closes the reader while
  // it is in flight must not be navigated (or have the unlock timer started)
  // from whatever screen they are on by then. Set true in the body too, so a
  // dev StrictMode unmount/remount doesn't leave it false.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (unlockTimer.current) clearTimeout(unlockTimer.current)
    }
  }, [])
  useEffect(() => {
    if (!localUri) return
    if (status.isLoaded && playedUriRef.current !== localUri) {
      playedUriRef.current = localUri
      try { player.seekTo(0); player.play() } catch { /* not ready */ }
    }
  }, [localUri, status.isLoaded, player])

  const scenes = useMemo<{ scene: SceneSlug; time: SceneTime }[]>(() => {
    let last: { scene: SceneSlug; time: SceneTime } = { scene: 'park', time: 'day' }
    return (story?.pages ?? []).map((pg) => {
      const ref = parseSceneRef(pg.scene_plan?.scene, pg.scene_plan?.time)
      if (ref) last = ref
      return last
    })
  }, [story])

  useEffect(() => {
    // Leaving the reader while the story is still loading (✕ on the error
    // screen, a back gesture) left these to set state on an unmounted screen.
    let cancelled = false
    getActiveChildId().then((c) => { if (!cancelled) setChildId(c) })
    const lang = getTranslationLang()
    api.get<FullStory>(`/api/stories/${id}?lang=${lang}`).then((res) => {
      if (cancelled) return
      if (res.data) setStory(res.data)
      // A body with neither data nor error would otherwise leave the spinner
      // up forever.
      else setError(res.error || 'اتصال برقرار نشد. دوباره تلاش کن')
    })
    return () => { cancelled = true }
  }, [id, reloadKey])

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

  // Page turns start at the top: the page text scrolls, and the next page
  // otherwise opened wherever the last one was left.
  const scrollRef = useRef<ScrollView>(null)
  // One completion POST per finish: a second «تمام شد» tap (or a quiz end
  // landing while the first request is in flight) used to post it again.
  const finishingRef = useRef(false)

  function goTo(idx: number) {
    setPageIdx(idx)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    if (childId && story) {
      void api.post('/api/progress/story', { child_id: childId, story_id: story.id, last_page: idx })
    }
  }

  /** «تمام شد 🎉». A story with usable comprehension questions gets the quiz
   *  first (same order as web: quiz, THEN completion), and finish() -- left
   *  exactly as it was -- runs when the quiz ends or is skipped. Without
   *  usable questions this is just finish(), as before. The page narration is
   *  paused so it doesn't keep talking over the quiz (the reader stays
   *  mounted underneath, unlike web's, so its player would otherwise play on). */
  function onFinishPress() {
    // Paused on both paths: without a quiz the narration also kept talking
    // over the badge popup / unlock screen.
    try { player.pause() } catch { /* not ready */ }
    if (story && usableQuestions(story.questions).length > 0) {
      setShowQuiz(true)
      return
    }
    finish()
  }

  function onQuizDone() {
    setShowQuiz(false)
    void finish()
  }

  async function finish() {
    if (finishingRef.current) return
    finishingRef.current = true
    if (!childId || !story) { goBack('/stories'); return }
    let res: ApiResponse<unknown> & { new_badges?: Badge[]; promotions?: Promotion[] }
    try {
      // new_badges / promotions are top-level on the response, not under `data`.
      res = await api.post('/api/progress/story', {
        child_id: childId, story_id: story.id, last_page: story.pages.length - 1, completed: true,
      })
    } catch {
      res = { data: null, error: 'اتصال برقرار نشد. دوباره تلاش کن' }
    }
    if (!mounted.current) return
    setRetryingSave(false)
    if (res.error || !res.data) {
      // Not saved: show the retry screen (the only way out of it is the
      // retry or «برگشت», so the child is never stuck) and let a retry run.
      setSaveError(res.error || 'اتصال برقرار نشد. دوباره تلاش کن')
      finishingRef.current = false
      return
    }
    // Saved: exactly as before.
    if (res.new_badges?.[0]) { setNewBadge(res.new_badges[0]); return }
    if (res.promotions?.length) {
      setShowUnlock(true)
      unlockTimer.current = setTimeout(() => goBack('/stories'), 2600)
      return
    }
    goBack('/stories')
  }

  /** Re-post the same completion. finishingRef (set again inside finish())
   *  drops a second tap; clearing the error first removes the button. */
  function retrySave() {
    if (finishingRef.current) return
    setSaveError(null)
    setRetryingSave(true)
    void finish()
  }

  if (!story) {
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        <LoadState error={error} onRetry={retry} onBack={() => goBack('/stories')} />
      </ScreenBackground>
    )
  }

  if (saveError !== null || retryingSave) {
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        <LoadState
          error={saveError}
          title="قصه تمام شد، ولی ذخیره نشد"
          character="pashmak"
          emotion="encouraging"
          onRetry={retrySave}
          onBack={() => goBack('/stories')}
        />
      </ScreenBackground>
    )
  }

  if (showQuiz) {
    return <StoryQuiz questions={usableQuestions(story.questions)} onDone={onQuizDone} />
  }

  if (showUnlock) {
    return (
      <ScreenBackground variant="warm" style={[styles.center, styles.unlock]}>
        {/* Mounted only on this branch: one burst + the completion sound. */}
        <CelebrationOverlay />
        {/* پشمک, the stories host, proud = success (Clay.tsx art rules), in
            the stories disc with a gift at its shoulder: something opened. */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <HostAvatar ramp={ramps.stories} size={148} character="pashmak" emotion="proud" />
          <View style={styles.unlockGift}>
            <GiftBox size={56} />
          </View>
          <View style={styles.unlockSparkle}>
            <Sparkle size={28} color={ramps.rewards.bright} />
          </View>
        </View>
        <Text style={styles.unlockTitle} accessibilityRole="header">محتوای جدید باز شد!</Text>
        <Text style={styles.unlockSub}>داستان‌ها و درس‌های تازه منتظرت هستند</Text>
      </ScreenBackground>
    )
  }

  const isLast = pageIdx === story.pages.length - 1
  const pageImg = page ? thumbUrl(page.image_url, 400) : null
  const coverImg = thumbUrl(story.cover_url, 400)
  const shownPageImg = pageImg && !failedImages.has(pageImg) ? pageImg : null
  const shownCover = coverImg && !failedImages.has(coverImg) ? coverImg : null
  const lang = getTranslationLang()
  const pageCount = `${toPersianDigits(pageIdx + 1)} از ${toPersianDigits(story.pages.length)}`

  return (
    <ScreenBackground variant="warm" style={{ paddingTop: insets.top + 8 }}>
      {newBadge && <RewardPopup badge={newBadge} onClose={() => goBack('/stories')} />}

      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="بستن" onPress={() => goBack('/stories')} hitSlop={10}>
          {/* The same white 44pt disc as ScreenHeader's back button. */}
          {({ pressed }) => (
            <View style={[styles.closeDisc, pressed && styles.closePressed]}>
              <Icon name="close" color={scenery.ink} size={20} strokeWidth={2.6} />
            </View>
          )}
        </Pressable>
        {/* Two lines, not one: a long title used to lose most of itself to «…». */}
        <Text style={styles.storyTitle} numberOfLines={2} accessibilityRole="header">{story.title_persian}</Text>
        {/* «۲ از ۵», not «۲ / ۵»: with no strong character the slash form's
            order depended on each platform's paragraph direction. */}
        <View accessible accessibilityLabel={`صفحه‌ی ${pageCount}`}>
          <ClayChip ramp={ramps.stories} label={pageCount} />
        </View>
      </View>
      {/* Where you are in the book, at a glance: the chip above says it in
          words (and to screen readers), so this is decorative. A row, so the
          fill grows from the reading start. */}
      <ProgressTrack
        value={pageIdx + 1}
        total={Math.max(1, story.pages.length)}
        ramp={ramps.stories}
        fillColor={ramps.stories.bright}
        height={6}
        decorative
        style={styles.bookTrack}
      />

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.pageContent}>
        {/* Illustration: a real page image wins. Most stories have no per-page
            art yet — until they do, fall back to the story's own cover
            (muted), so the page still carries that story's visual identity
            instead of a generic scene. Only a story with no cover either
            falls back to the scene library. Mirrors web's StoryReader. */}
        {/* Decorative: the page text below carries the story. */}
        <View style={styles.pageImageWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {/* A clay picture frame (white mat, stories edge): the page's art
              leads, the text follows. */}
          <ClaySurface ramp={ramps.stories} tone="soft" radius={radii.lg} edge={clay.edgeSm} faceStyle={styles.frameFace}>
          {shownPageImg ? (
            <Image
              key={shownPageImg}
              source={{ uri: shownPageImg }}
              style={styles.pageImage}
              contentFit="contain"
              transition={150}
              onError={() => markFailed(shownPageImg)}
            />
          ) : shownCover ? (
            <Image
              source={{ uri: shownCover }}
              style={[styles.pageImage, styles.pageImageMuted]}
              contentFit="cover"
              transition={150}
              onError={() => markFailed(shownCover)}
            />
          ) : (
            <SceneBackdrop scene={scenes[pageIdx]?.scene ?? 'park'} time={scenes[pageIdx]?.time ?? 'day'} style={styles.pageImage} />
          )}
          </ClaySurface>
        </View>
        {page && <Text style={styles.pageText}>{RLM + page.text_persian}</Text>}
        {page?.translation ? (
          <Text
            style={[styles.pageTranslation, { writingDirection: RTL_LANGS.has(lang) ? 'rtl' : 'ltr' }]}
            accessibilityLanguage={lang}
          >
            {page.translation}
          </Text>
        ) : null}
        {audioUri && <AudioBar player={player} status={status} />}
      </ScrollView>

      <View style={[styles.nav, { paddingBottom: insets.bottom + 16 }]}>
        {/* Previous is the quiet secondary; next/finish the bright primary.
            Finish keeps its green (lessons ramp = success) so the last page
            still reads differently from a page turn. */}
        <ClayButton ramp={ramps.stories} tone="soft" label="قبلی" accessibilityLabel="صفحه‌ی قبل" disabled={pageIdx === 0} onPress={() => goTo(pageIdx - 1)} style={styles.navPrev} />
        {isLast ? (
          <ClayButton ramp={ramps.lessons} label="تمام شد" emoji="🎉" accessibilityLabel="تمام شد" onPress={onFinishPress} style={styles.navNext} />
        ) : (
          <ClayButton ramp={ramps.stories} label="بعدی" accessibilityLabel="صفحه‌ی بعد" onPress={() => goTo(pageIdx + 1)} style={styles.navNext} />
        )}
      </View>
    </ScreenBackground>
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

  // VoiceOver/TalkBack swipe up/down on the bar: 5 seconds either way.
  function nudge(delta: number) {
    if (dur <= 0) return
    try { player.seekTo(Math.max(0, Math.min(dur, cur + delta))) } catch { /* not ready */ }
  }

  function seek(e: GestureResponderEvent) {
    const lx = e.nativeEvent.locationX
    // No position (a screen reader's activation carries none): NaN would reach
    // seekTo, since Math.min/max pass NaN through.
    if (!trackW || dur <= 0 || !Number.isFinite(lx)) return
    // locationX is physical (from the left edge), but under RTL the fill and
    // knob run from the right, so measure from the right too. Without this a
    // tap at the bar's end rewound to 0:00 (seen on the iOS Simulator).
    const x = I18nManager.isRTL ? trackW - lx : lx
    const f = Math.max(0, Math.min(1, x / trackW))
    try { player.seekTo(f * dur) } catch { /* not ready */ }
  }

  return (
    <ClaySurface ramp={ramps.stories} tone="soft" radius={radii.md} edge={clay.edgeSm} style={styles.audioBar} faceStyle={styles.audioFace}>
      <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? 'مکث' : 'پخش'} onPress={toggle} hitSlop={6}>
        {({ pressed }) => (
          <ClaySurface ramp={ramps.stories} tone="bright" pressed={pressed} radius={radii.pill} edge={clay.edgeSm} faceStyle={styles.playFace}>
            {loading ? (
              <ActivityIndicator color={ramps.stories.ink} size="small" />
            ) : status.playing ? (
              <Icon name="pause" color={ramps.stories.ink} size={24} strokeWidth={3.4} />
            ) : (
              <Icon name="play" color={ramps.stories.ink} size={24} />
            )}
          </ClaySurface>
        )}
      </Pressable>
      <View style={{ flex: 1, gap: 5 }}>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="نوار صدا"
          accessibilityValue={{ text: `${fmtTime(cur)} از ${fmtTime(dur)}` }}
          // 'activate' is claimed (and ignored, as a slider's double-tap is) so
          // VoiceOver doesn't fall back to a synthetic tap at the bar's centre,
          // which seeked to the middle of the clip.
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') nudge(5)
            else if (e.nativeEvent.actionName === 'decrement') nudge(-5)
          }}
          onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
          onPress={seek}
          hitSlop={10}
          style={styles.track}
        >
          {/* Not touch targets: locationX is relative to the view actually
              touched, so a tap on the fill or knob measured from THEIR edge
              and seeked to the wrong place. */}
          <View pointerEvents="none" style={[styles.trackFill, { width: `${frac * 100}%` }]} />
          <View pointerEvents="none" style={[styles.knob, { left: `${frac * 100}%` }]} />
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmtTime(cur)}</Text>
          <Text style={styles.time}>{loading ? 'در حال بارگذاری…' : fmtTime(dur)}</Text>
        </View>
      </View>
    </ClaySurface>
  )
}

// Home's rhythm between sibling items.
const GAP = spacing.sm + spacing.xs

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  unlock: { gap: GAP, padding: spacing.lg },
  // Bottom-end of the disc (RN swaps `right` under RTL; a round badge on a
  // round disc reads the same on either shoulder).
  unlockGift: { position: 'absolute', bottom: -6, right: -10 },
  unlockSparkle: { position: 'absolute', top: 2, left: -6 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: GAP, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  bookTrack: { marginHorizontal: spacing.md, marginBottom: spacing.xs },
  closeDisc: {
    width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.card,
    borderWidth: 2, borderColor: scenery.line, alignItems: 'center', justifyContent: 'center',
  },
  closePressed: { opacity: 0.6 },
  storyTitle: { flex: 1, fontSize: textSize.cardTitle, fontFamily: fonts.display, color: scenery.ink, textAlign: textStart },
  pageContent: { padding: spacing.md + 4, gap: spacing.md + 2, alignItems: 'center' },
  pageImageWrap: { alignSelf: 'stretch' },
  frameFace: { padding: spacing.xs + 2, backgroundColor: colors.card },
  // 4:3 picture-book shape (~210pt tall on a 320pt phone, ~262 at 390),
  // capped so a tablet's page still leaves room for the words.
  pageImage: { width: '100%', aspectRatio: 4 / 3, maxHeight: 320, borderRadius: radii.md, backgroundColor: ramps.stories.soft },
  // The story's cover standing in for missing page art: a little quieter
  // than real page art, but no longer washed out (was 0.4).
  pageImageMuted: { opacity: 0.72 },
  pageText: {
    fontSize: 22, lineHeight: 44, fontFamily: fonts.medium, color: ui.textStrong,
    textAlign: 'center', writingDirection: 'rtl',
  },
  // ui.textMuted (5.65:1 on the gradient's darkest stop): the translation
  // reads as the quieter second voice under the Persian.
  pageTranslation: {
    fontSize: 15, lineHeight: naturalLineHeight(15) + 2, fontFamily: fonts.regular, color: ui.textMuted,
    textAlign: 'center',
  },
  audioBar: { alignSelf: 'stretch' },
  audioFace: { flexDirection: 'row', alignItems: 'center', gap: GAP + 2, padding: GAP },
  playFace: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  // The track, fill and knob geometry is the seek's contract (see seek()):
  // only colours changed here.
  // ui.track: a warm translucent ink, not the cold grey colors.border.
  track: { height: 8, borderRadius: 999, backgroundColor: ui.track, justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: ramps.stories.bright, borderRadius: 999 },
  knob: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: ramps.stories.deep, marginLeft: -8, top: -4,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: textSize.micro, fontFamily: fonts.medium, color: ramps.stories.ink },
  nav: { flexDirection: 'row', gap: GAP, paddingHorizontal: spacing.md + 4, paddingTop: GAP },
  // The primary gets the wider share (as in write.tsx): at 320pt an even
  // split left «تمام شد» + 🎉 about 56pt, short of the label.
  navPrev: { flex: 1 },
  navNext: { flex: 1.5 },
  unlockTitle: { fontSize: textSize.h2, fontFamily: fonts.display, color: scenery.ink, textAlign: 'center' },
  unlockSub: { fontSize: textSize.small, fontFamily: fonts.regular, color: colors.text, textAlign: 'center' },
})
