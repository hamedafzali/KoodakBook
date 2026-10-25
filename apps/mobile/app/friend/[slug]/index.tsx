import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter, CharacterLine } from '@koodakbook/shared'
import { isSceneSlug } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { playClip, stopClip } from '@/lib/sound'
import FriendAvatar, { friendRamp } from '@/components/FriendAvatar'
import { colors, fonts, radii, ramps, scenery, spacing, textSize, textStart, type Ramp } from '@/lib/theme'
import BottomNav from '@/components/BottomNav'
import ScreenBackground from '@/components/ScreenBackground'
import { ClaySurface, HostAvatar } from '@/components/Clay'
import Icon, { type IconName } from '@/components/Icon'
import LoadState from '@/components/LoadState'
import { hasCharacterArt } from '@/lib/characterSvg'
import SceneBackdrop from '@/components/SceneBackdrop'

/**
 * A friend's home (web: /child/friends/[slug]) — greeting plays on arrival,
 * tapping the character replays it, plus doors to the memory game, قصه‌ها
 * and «حرف بزنیم» (./talk).
 *
 * 2026-09-25 visual convergence with Home: the habitat is now a full-bleed
 * hero like Home's (scene art filling it through an absoluteFill wrapper, the
 * friend standing on it), the name + greeting sit in one soft clay card that
 * overlaps the hero's bottom the way Home's continue card does, and the three
 * doors are bright clay cards with ink text and the room's emoji in a white
 * HostAvatar disc. Routes, the greeting logic and FriendAvatar are unchanged.
 *
 * 2026-09-28 visual fidelity (routes, greeting timing/focus gating, the
 * one-push guard and every label's words unchanged):
 *  - Hero in Home's language: words at the reading start, the character at
 *    the end. The greeting is now the friend's own speech bubble in the
 *    scene (white, small corner toward the friend), so it reads as the
 *    friend talking; tapping the friend still replays it.
 *  - The intro card wears the friend's own ramp (friendRamp: the colour they
 *    have as a host on Home and on the friends grid) with the name, the
 *    whole personality and «دوباره بشنو» as a clay button with the volume
 *    icon (was 🔊).
 *  - Doors: the play and talk rooms show the shared Icon set's gamepad and
 *    chat in a white disc (were 🃏 / 💬), stories keeps پشمک; each door ends
 *    in a white «go» disc like Home's continue card. The scroll clears the
 *    bottom bar at 130% text with room to spare.
 */
function lineFor(c: AppCharacter, trigger: string): CharacterLine | null {
  const matches = (c.lines ?? []).filter((l) => l.trigger === trigger)
  return matches.length ? matches[Math.floor(Math.random() * matches.length)] : null
}

export default function FriendHome() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const insets = useSafeAreaInsets()
  const [chars, setChars] = useState<AppCharacter[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }

  useEffect(() => {
    let cancelled = false
    // A failed fetch used to leave the spinner up for good.
    api.get<AppCharacter[]>('/api/characters').then((r) => {
      if (cancelled) return
      if (r.data) setChars(r.data)
      else setError(r.error ?? 'اتصال برقرار نشد. دوباره تلاش کن')
    })
    return () => { cancelled = true }
  }, [reloadKey])

  // The friend's size in the hero: 160 on a standard phone, less on narrow ones.
  const { width: winW } = useWindowDimensions()
  const heroArt = Math.round(Math.min(156, winW * 0.38))
  // With a greeting bubble at the reading start, the scene is drawn wider
  // than the hero and anchored at the reading start, so its centre -- where
  // every scene keeps its focal object (سیمرغ's balloon, لاکی's boat, the
  // garden's house) -- moves toward the friend at the reading end and sits
  // behind them instead of behind the bubble. 0.36 of the width keeps the
  // scene's slice scale height-driven at 320-402pt (the hero is ~300-330pt
  // tall: width <= height x 400/240), so nothing in it grows.
  const sceneShift = Math.round(winW * 0.36)

  const character = useMemo(() => chars?.find((c) => c.slug === slug) ?? null, [chars, slug])
  const greeting = useMemo(() => (character ? lineFor(character, 'greeting') : null), [character])

  // A double tap on a door pushed its screen twice. One push per visit;
  // coming back here re-arms it.
  const opening = useRef(false)
  // Whether this page is the one on screen. The arrival greeting below waits
  // 450ms; a door tapped inside that window used to blur the page first (the
  // stopClip below found nothing to stop) and the timer then started the
  // greeting over the next screen.
  const focused = useRef(false)
  // Re-armed on every return; on leaving (a door, back, the nav), the
  // greeting stops instead of talking over the next screen -- this page
  // stays mounted underneath the one it opened.
  useFocusEffect(useCallback(() => {
    opening.current = false
    focused.current = true
    return () => { focused.current = false; stopClip() }
  }, []))
  const go = (path: Parameters<typeof router.push>[0]) => {
    if (opening.current) return
    opening.current = true
    router.push(path)
  }

  // The greeting IS the introduction — plays the moment the child arrives.
  useEffect(() => {
    if (!greeting?.audio_url) return
    const t = setTimeout(() => { if (focused.current) playClip(greeting.audio_url) }, 450)
    return () => clearTimeout(t)
  }, [greeting])

  if (!chars) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={error} onRetry={retry} onBack={() => goBack('/friends')} />
        </View>
      </ScreenBackground>
    )
  }
  // Unknown slug: a stable not-found state with a deliberate way back. It
  // used to call goBack() during render, a navigation side effect on every
  // render of this state.
  if (!character) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState title="این دوست پیدا نشد" error={'این دوست در فهرست دوست‌ها نیست.'} onBack={() => goBack('/friends')} />
        </View>
      </ScreenBackground>
    )
  }

  // Stories' door gets Home's stories host (پشمک, see home.tsx TILES); play
  // and talk are with THIS friend, already large above, so they keep the
  // room's symbol rather than another character.
  const doors: { key: string; ramp: Ramp; icon: IconName; character?: string; title: string; sub: string; onPress: () => void }[] = [
    {
      key: 'play', ramp: ramps.games, icon: 'gamepad', title: 'با هم بازی کنیم!', sub: `بازی حافظه با ${character.name_persian}`,
      onPress: () => go(`/games/memory?host=${character.slug}`),
    },
    {
      key: 'stories', ramp: ramps.stories, icon: 'book', character: hasCharacterArt('pashmak') ? 'pashmak' : undefined,
      title: 'قصه بگو!', sub: 'برو سراغ قصه‌ها',
      onPress: () => go('/stories'),
    },
    {
      key: 'talk', ramp: ramps.speak, icon: 'chat', title: 'حرف بزنیم!', sub: `${character.name_persian} گوش می‌کنه و جواب می‌ده`,
      onPress: () => go(`/friend/${character.slug}/talk`),
    },
  ]
  const ramp = friendRamp(character.slug)

  return (
    <ScreenBackground variant="warm">
      <ScrollView
        style={{ flex: 1 }}
        // Clears BottomNav at its 130% text cap (~111pt with a home
        // indicator) with a comfortable gap under the last door.
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
      >
        {/* The character's own habitat, not a flat emoji-in-a-circle -- the
            single largest visual-richness gap the audit found (UX High #14).
            home_scene is a real per-character column in this scene-library
            slug space; isSceneSlug guards an unexpected/legacy value. Full
            bleed under the status bar, like Home's hero; the wrapper is what
            fills the hero (see home.tsx) and hides the art from readers. */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          <View
            style={greeting ? [styles.sceneShifted, { width: winW + sceneShift }] : StyleSheet.absoluteFill}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <SceneBackdrop
              scene={isSceneSlug(character.home_scene) ? character.home_scene : 'garden'}
              style={SCENE_FILL}
            />
          </View>
          {/* A row: back sits at the reading start (the right under RTL). */}
          <View style={styles.heroTop}>
            <Pressable accessibilityRole="button" accessibilityLabel="برگشت" onPress={() => goBack('/friends')} hitSlop={10}>
              {({ pressed }) => (
                <View style={[styles.backDisc, pressed && styles.pressed]}>
                  <Icon name="back" color={scenery.ink} size={22} strokeWidth={2.5} />
                </View>
              )}
            </Pressable>
          </View>

          {/* Home's hero row: words at the reading start (first child =
              right under RTL), the friend at the end. The greeting is the
              friend's speech bubble, standing on the same ground line as
              the friend (nothing of the scene shows under it, so a tree or
              the balloon it covers never reads as a bare post), with a tail
              at its end edge pointing at them. */}
          <View style={[styles.heroMain, !greeting && styles.heroMainSolo]}>
            {greeting && (
              <View style={[styles.speech, { borderColor: ramp.bright }]}>
                <View style={[styles.speechTail, { borderColor: ramp.bright }]} />
                <Text style={styles.speechText}>{greeting.text_persian}</Text>
              </View>
            )}
            {/* Without a greeting clip a tap does nothing: say so (disabled)
                rather than promising «دوباره بشنو». */}
            <Pressable accessibilityRole="button"
              accessibilityLabel={greeting?.audio_url ? `${character.name_persian}، دوباره بشنو` : character.name_persian}
              disabled={!greeting?.audio_url}
              style={styles.heroChar}
              onPress={() => greeting?.audio_url && playClip(greeting.audio_url)}
            >
              <FriendAvatar character={character} size={heroArt} ramp={ramp} emotion="happy" />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {/* Who this is, and what they say: one soft clay card over the
              hero's bottom edge (Home's continue-card position). */}
          <ClaySurface ramp={ramp} tone="soft" radius={radii.lg} style={styles.introWrap} faceStyle={styles.introFace}>
            <Text style={[styles.name, { color: ramp.ink }]} accessibilityRole="header">{character.name_persian}</Text>
            {character.personality ? <Text style={styles.personality}>{character.personality}</Text> : null}
            {greeting?.audio_url && (
              // ClayButton's press/label rules, with the Icon set's volume
              // glyph in place of its emoji slot.
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="دوباره بشنو"
                onPress={() => playClip(greeting.audio_url)}
                style={styles.listen}
              >
                {({ pressed }) => (
                  <ClaySurface ramp={ramp} tone="bright" pressed={pressed} radius={radii.lg} faceStyle={styles.listenFace}>
                    <Icon name="volume" color={ramp.ink} size={24} strokeWidth={2.5} />
                    <Text style={[styles.listenLabel, { color: ramp.ink }]}>دوباره بشنو</Text>
                  </ClaySurface>
                )}
              </Pressable>
            )}
          </ClaySurface>

          {doors.map((d) => (
            <Pressable
              key={d.key}
              accessibilityRole="button"
              accessibilityLabel={`${d.title} ${d.sub}`}
              onPress={d.onPress}
            >
              {({ pressed }) => (
                <ClaySurface ramp={d.ramp} tone="bright" pressed={pressed} radius={radii.lg} faceStyle={styles.doorFace}>
                  {d.character ? (
                    <HostAvatar ramp={d.ramp} size={DOOR_ART} character={d.character} emotion="happy" />
                  ) : (
                    <View style={[styles.doorDisc, { borderColor: d.ramp.soft }]}>
                      <Icon name={d.icon} color={d.ramp.deep} size={30} strokeWidth={2.25} />
                    </View>
                  )}
                  <View style={styles.doorText}>
                    <Text style={[styles.doorTitle, { color: d.ramp.ink }]}>{d.title}</Text>
                    <Text style={[styles.doorSub, { color: d.ramp.ink }]}>{d.sub}</Text>
                  </View>
                  {/* Home's continue-card «go» disc; the card is the button. */}
                  <View style={styles.doorGo}>
                    <Icon name="chevron" color={d.ramp.ink} size={20} strokeWidth={3} />
                  </View>
                </ClaySurface>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <BottomNav />
    </ScreenBackground>
  )
}

// SceneBackdrop rounds its own corners (16); full bleed, it must not.
const SCENE_FILL = [StyleSheet.absoluteFill, { borderRadius: 0 }]

const GAP = spacing.sm + spacing.xs
const DOOR_ART = 60

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Tall enough for the scene to read as a place, with room at the bottom
  // for the intro card to overlap it.
  hero: {
    minHeight: 300, paddingHorizontal: spacing.md, paddingBottom: spacing.xl + spacing.md,
    overflow: 'hidden', justifyContent: 'space-between',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  // The same 44pt white disc as ScreenHeader's child back button.
  backDisc: {
    width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.card,
    borderWidth: 2, borderColor: scenery.line, alignItems: 'center', justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  heroMain: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  heroMainSolo: { justifyContent: 'center' },
  // The scene, wider than the hero and anchored at the reading start (`start`
  // is the right edge under RTL), so its centre sits behind the friend.
  sceneShifted: { position: 'absolute', top: 0, bottom: 0, start: 0 },
  // The friend's speech bubble: white (its text never sits on the scene's
  // colours), in the friend's ramp rim. No bottom margin: its foot is the
  // friend's ground line, and its minimum height covers the scenes' focal
  // band, so an object behind it shows (if at all) only above it, like
  // something standing behind a sign -- never a trunk or basket below it
  // (simulator, 402pt, سیمرغ's sky balloon). Words centred in it.
  speech: {
    flex: 1, minWidth: 0, minHeight: 112, justifyContent: 'center',
    backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 2,
    paddingHorizontal: GAP, paddingVertical: spacing.sm + 2,
  },
  // RoomBand's tail (components/RoomScene.tsx): a turned square on the END
  // edge, its top+end corner facing the friend -- counter-clockwise under
  // RTL, where `end` is the left. Near the top, toward the friend's face.
  speechTail: {
    position: 'absolute', end: -7, top: spacing.lg, width: 12, height: 12,
    backgroundColor: colors.card, borderTopWidth: 2, borderEndWidth: 2,
    transform: [{ rotate: I18nManager.isRTL ? '-45deg' : '45deg' }],
  },
  speechText: { fontSize: textSize.small, fontFamily: fonts.medium, color: colors.text, textAlign: textStart },
  heroChar: { alignItems: 'center', justifyContent: 'flex-end', minWidth: 44, minHeight: 44 },

  body: { paddingHorizontal: spacing.md, gap: GAP },
  introWrap: { marginTop: -spacing.xl, marginBottom: spacing.xs },
  introFace: { padding: spacing.md, alignItems: 'stretch', gap: spacing.sm },
  name: { fontSize: textSize.h2, fontFamily: fonts.display, color: scenery.ink, textAlign: 'center' },
  // colors.text, not muted: secondary text reads on the pale face at full contrast.
  personality: { fontSize: textSize.small, fontFamily: fonts.regular, color: colors.text, textAlign: 'center' },
  listen: { marginTop: spacing.xs, alignSelf: 'center', minWidth: 200 },
  // ClayButton's face: 56pt minimum, grows when the label wraps.
  listenFace: {
    minHeight: 56, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  listenLabel: { fontFamily: fonts.display, fontSize: textSize.body, textAlign: 'center', flexShrink: 1 },

  doorFace: { flexDirection: 'row', alignItems: 'center', gap: GAP, padding: GAP, minHeight: 88 },
  doorDisc: {
    width: DOOR_ART, height: DOOR_ART, borderRadius: radii.pill, borderWidth: 3,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  doorGo: {
    width: 36, height: 36, borderRadius: radii.pill, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  doorText: { flex: 1, gap: 2 },
  doorTitle: { fontSize: textSize.body, fontFamily: fonts.display, textAlign: textStart },
  // Full ink, not ink at 75% opacity: the dimmed sub lost contrast on the bright faces.
  doorSub: { fontSize: textSize.caption, fontFamily: fonts.medium, textAlign: textStart },
})
