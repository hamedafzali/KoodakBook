import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Word } from '@koodakbook/shared'
import { toPersianDigits, wordEmoji } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { playClip, stopClip } from '@/lib/sound'
import { thumbUrl } from '@/lib/media'
import { fonts, iconSize, naturalLineHeight, radii, ramps, spacing, textSize, textStyles, ui } from '@/lib/theme'
import ScreenBackground from '@/components/ScreenBackground'
import { CharacterArt, ClayButton, ClaySurface } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { RoomBand, RoomProgress } from '@/components/RoomScene'
import BottomNav from '@/components/BottomNav'
import LoadState, { EmptyState } from '@/components/LoadState'
import { goBack } from '@/lib/navigation'

/**
 * تمرین گفتن (web: /child/speak) — listen and repeat. Web grades pronunciation
 * with the browser's Web Speech API; React Native has no in-Expo-Go equivalent,
 * so this is web's graceful "unsupported" path: hear the word, say it aloud,
 * tap «گفتم» to confirm — which records a productive-track rep (the point of
 * the module). Automatic pronunciation checking can come with a dev build.
 */
export default function Speak() {
  const insets = useSafeAreaInsets()
  const [words, setWords] = useState<Word[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }
  const [idx, setIdx] = useState(0)
  const [childId, setChildId] = useState('')
  const [said, setSaid] = useState(false)
  // `said` is state, so two taps on «گفتم» in one frame both saw false and
  // posted two productive reps for one word. The ref flips at once and
  // resets with each new word.
  const saidRef = useRef(false)
  // A word still playing when the child leaves must not follow them.
  useEffect(() => () => stopClip(), [])

  useEffect(() => {
    // Leaving before the fetch settles used to set state on an unmounted screen.
    let alive = true
    async function load() {
      const activeId = await getActiveChildId()
      if (!alive) return
      if (activeId) setChildId(activeId)
      const res = await api.get<Word[]>('/api/words')
      if (!alive) return
      // A failed fetch used to land on the empty «کلمه‌ای نیست» state.
      if (!res.data) { setError(res.error ?? 'اتصال برقرار نشد. دوباره تلاش کن'); return }
      const all = res.data
      // Prefer words with a real image or, failing that, an emoji, so the
      // child always has a visual cue — same test QuizCard uses, not emoji-only.
      const withVisual = all.filter((w) => w.image_url || wordEmoji(w.english))
      setWords((withVisual.length >= 8 ? withVisual : all).slice(0, 20))
    }
    load()
    return () => { alive = false }
  }, [reloadKey])

  const word = words?.[idx]

  // Say each word as it appears; the card stays tappable for replay.
  useEffect(() => {
    if (!word) return
    const t = setTimeout(() => playClip(word.audio_url), 350)
    return () => clearTimeout(t)
  }, [word?.id])

  if (!words) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={error} onRetry={retry} onBack={() => goBack('/home')} />
        </View>
      </ScreenBackground>
    )
  }
  if (words.length === 0 || !word) {
    // The header and nav too: this used to be a bare line with no way out.
    return (
      <ScreenBackground variant="warm">
        <RoomBand ramp={ramps.speak} character="ava" title="تمرین گفتن" topInset={insets.top} />
        {/* A successful, empty list: a friendly note, not an error. */}
        <View style={[styles.center, styles.emptyWrap]}>
          <EmptyState
            character="ava"
            emotion="thinking"
            title="هنوز کلمه‌ای برای گفتن نیست"
            body="به‌زودی کلمه‌های تازه می‌رسه."
          />
        </View>
        <BottomNav />
      </ScreenBackground>
    )
  }

  const image = thumbUrl(word.image_url, 112)
  const emoji = wordEmoji(word.english)

  function confirmSaid() {
    if (said || saidRef.current || !word) return
    saidRef.current = true
    setSaid(true)
    // The live region below is Android-only; VoiceOver needs telling.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility('آفرین! تمرین کردی')
    // Productive-track rep — the child produced the word (web posts this on a
    // recognition match; here it's self-reported).
    if (childId) {
      void api.post('/api/progress/word', {
        child_id: childId, word_id: word.id, status: 'practiced', track: 'productive',
      })
    }
  }

  function nextWord() {
    saidRef.current = false
    setSaid(false)
    setIdx((i) => (i + 1) % (words?.length ?? 1))
  }

  return (
    <ScreenBackground variant="warm">
      {/* Scrolls, like write.tsx: BottomNav is absolutely positioned, and the
       * old fixed column pinned «کلمه بعدی» (marginTop: 'auto') to
       * insets.bottom + 16 -- underneath the ~70-94pt nav bar -- and ran past
       * the screen on short phones. flexGrow keeps the button low on tall ones. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 108 }]}
      >
        {/* The speak room's band (components/RoomScene.tsx): آوا, the room's
            host (Home's room card), on the pink-tinted hills; the how-to line
            (was a separate pill) and the word count as a track. Full-bleed. */}
        <View style={styles.bandWrap}>
          <RoomBand
            ramp={ramps.speak}
            character="ava"
            title="تمرین گفتن"
            subtitle="اول گوش کن، بعد بلند تکرار کن"
            topInset={insets.top}
          >
            <RoomProgress
              ramp={ramps.speak}
              done={idx}
              total={words.length}
              meta={`کلمه ${toPersianDigits(idx + 1)} از ${toPersianDigits(words.length)}`}
              label={`کلمه ${toPersianDigits(idx + 1)} از ${toPersianDigits(words.length)}`}
            />
          </RoomBand>
        </View>

        {/* Word card — tap to hear again */}
        <Pressable
          style={styles.cardWrap}
          onPress={() => playClip(word.audio_url)}
          accessibilityRole="button"
          accessibilityLabel={`${word.persian}، بشنو`}
        >
          {({ pressed }) => (
            <ClaySurface ramp={ramps.speak} tone="soft" pressed={pressed} radius={radii.lg} faceStyle={styles.card}>
              {image ? (
                <Image source={{ uri: image }} style={styles.cardImage} contentFit="contain" />
              ) : emoji ? (
                <Text style={styles.cardEmoji}>{emoji}</Text>
              ) : null}
              <Text style={styles.cardWord}>{word.persian}</Text>
              <Text style={styles.cardLatin}>{word.english}</Text>
              <View style={styles.listenRow}>
                <Icon name="volume" color={ramps.speak.ink} size={iconSize.inline} />
                <Text style={styles.cardListen}>دوباره بشنو</Text>
              </View>
            </ClaySurface>
          )}
        </Pressable>

        {said ? (
          <View style={styles.feedback} accessibilityLiveRegion="polite">
            <CharacterArt character="ava" emotion="proud" size={88} />
            <Text style={styles.feedbackText}>آفرین! تمرین کردی</Text>
          </View>
        ) : (
          // The screen's one primary action, so Home's deep clay (white is
          // allowed only on the deep stop, >=7:1): the mic and «گفتم!».
          <Pressable onPress={confirmSaid} accessibilityRole="button" accessibilityLabel="گفتم">
            {({ pressed }) => (
              <ClaySurface ramp={ramps.speak} tone="deep" pressed={pressed} radius={radii.pill} faceStyle={styles.sayButton}>
                <Icon name="mic" color={ui.onDeep} size={40} strokeWidth={2.2} />
                <Text style={styles.sayButtonText}>گفتم!</Text>
              </ClaySurface>
            )}
          </Pressable>
        )}

        {/* Secondary while «گفتم» is the job; the primary action once it's done. */}
        <ClayButton
          ramp={ramps.speak}
          tone={said ? 'bright' : 'soft'}
          label="کلمه بعدی"
          icon="chevron"
          iconPosition="end"
          onPress={nextWord}
          style={styles.nextButton}
        />
      </ScrollView>
      <BottomNav />
    </ScreenBackground>
  )
}


const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: spacing.md, gap: spacing.md, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Clear of the absolutely positioned BottomNav.
  emptyWrap: { paddingBottom: 96 },
  // Full-bleed: undo the container's side padding for the band.
  bandWrap: { alignSelf: 'stretch', marginHorizontal: -spacing.md },
  cardWrap: { width: '100%', maxWidth: 360 },
  card: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  // No fixed lineHeight: ~1.17x cut emoji on Android; the system emoji
  // font's own height is right (Vazirmatn's naturalLineHeight isn't).
  cardEmoji: { fontSize: 72 },
  cardImage: { width: 112, height: 112 },
  cardWord: { fontSize: 44, lineHeight: naturalLineHeight(44), fontFamily: fonts.display, color: ramps.speak.ink, textAlign: 'center' },
  cardLatin: { fontSize: textSize.small, fontFamily: fonts.regular, color: ui.textMuted },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  cardListen: { ...textStyles.label, color: ramps.speak.ink },
  feedback: { alignItems: 'center', gap: spacing.xs },
  // ui.success (the lessons ink), not colors.success: #22c55e is ~2:1 here.
  feedbackText: { fontSize: textSize.body, fontFamily: fonts.bold, color: ui.success },
  // Still the big round target (128pt), now deep clay: the one primary
  // action. White sits only on the deep stop (theme ui.onDeep, >=7:1).
  sayButton: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center', gap: 2 },
  sayButtonText: { color: ui.onDeep, fontSize: textSize.cardTitle, fontFamily: fonts.display },
  nextButton: { width: '100%', maxWidth: 360, marginTop: 'auto' },
})
