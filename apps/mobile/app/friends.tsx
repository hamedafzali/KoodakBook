import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter } from '@koodakbook/shared'
import { isSceneSlug } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { colors, fonts, radii, ramps, spacing, textSize } from '@/lib/theme'
import { RoomBand } from '@/components/RoomScene'
import ScreenBackground from '@/components/ScreenBackground'
import { ClaySurface } from '@/components/Clay'
import BottomNav from '@/components/BottomNav'
import FriendAvatar, { friendRamp, shortPersonality } from '@/components/FriendAvatar'
import SceneBackdrop from '@/components/SceneBackdrop'
import LoadState, { EmptyState } from '@/components/LoadState'
import { goBack } from '@/lib/navigation'

/** دوست‌ها — the interactive characters roster (web: home's friends row).
 *
 * 2026-09-25 visual convergence with Home: warm page gradient, soft clay
 * cards in the friends room's ramp (Home's «دوست‌ها» tile is ramps.phonics),
 * each friend in a white HostAvatar-style disc, the name in the display cut.
 * Cards get an explicit width and fill their row, so two friends with
 * personalities of different length still end on the same line.
 *
 * 2026-09-27: the title's 🦊 is gone (a screen reader read it out as part of
 * the heading, and no friend in the cast is a fox); an empty roster is its
 * own calm state with سیمرغ, never the load error.
 *
 * 2026-09-28 visual fidelity (the reference's warm illustrated world; data,
 * routes and the one-push guard unchanged):
 *  - One header (2026-09-29, the shared header system): RoomBand in the
 *    friends room's ramp (phonics, Home's «دوست‌ها» tile) with back, the
 *    title and سیمرغ (the app's guide) greeting the child in a white speech
 *    bubble -- replaces ScreenHeader + this screen's own garden band. It is
 *    the list's header, full bleed under the status bar, so it scrolls away
 *    with the grid. An empty roster keeps the band without the bubble.
 *  - Each card is a window into that friend's own home: their home_scene
 *    (the same scene their page opens on) as a stage, the character standing
 *    on it at ~0.6 of the card width instead of an 68pt head in a disc.
 *  - Each friend wears the ramp they wear as a host on Home (friendRamp), so
 *    the grid reads as a cast of characters rather than eight equal tiles;
 *    one radius (lg) and one clay edge for all of them.
 *  - The name in the display cut in the ramp's ink; one short tagline (the
 *    personality's traits, shortPersonality) instead of two cut-off lines.
 *    The whole personality is still in the spoken label. */
const GAP = spacing.sm + spacing.xs

export default function Friends() {
  const insets = useSafeAreaInsets()
  const [chars, setChars] = useState<AppCharacter[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }

  useEffect(() => {
    let cancelled = false
    api.get<AppCharacter[]>('/api/characters').then((res) => {
      if (cancelled) return
      if (res.data) setChars(res.data)
      // A response with no message must still leave the spinner.
      else setError(res.error ?? 'اتصال برقرار نشد. دوباره تلاش کن')
    })
    return () => { cancelled = true }
  }, [reloadKey])

  // A double tap on a card pushed the friend's home twice (two screens, two
  // greetings). One push per visit; coming back here re-arms it.
  const opening = useRef(false)
  useFocusEffect(useCallback(() => { opening.current = false }, []))
  const open = (slug: string) => {
    if (opening.current) return
    opening.current = true
    router.push(`/friend/${slug}`)
  }

  // Two columns inside the list's md gutters, GAP between them. A width, not
  // '48%' + flexGrow: a lone last card stays half width instead of stretching.
  const { width: winW } = useWindowDimensions()
  const cardW = Math.floor((winW - spacing.md * 2 - GAP) / 2)
  // The stage fills the card's face (minus its padding); the friend stands
  // on it at most 104pt tall, less on a 320pt phone.
  const stageW = cardW - STAGE_PAD * 2
  const stageH = Math.round(stageW * 0.74)
  const art = Math.min(104, stageH - spacing.sm)

  if (!chars) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={error} onRetry={retry} onBack={() => goBack('/home')} />
        </View>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
      <View style={styles.container}>
        <FlatList
          data={chars}
          keyExtractor={(c) => c.id}
          numColumns={2}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 112 }]}
          ListHeaderComponent={
            <View style={styles.bandWrap}>
              <RoomBand
                ramp={ramps.phonics}
                character="simorgh"
                size="tall"
                topInset={insets.top}
                title="دوست‌های من"
                speechTitle={chars.length ? 'با کی بازی کنیم؟' : undefined}
                speech={chars.length ? 'یه دوست رو بزن تا با هم بازی کنیم، قصه بشنویم یا حرف بزنیم.' : undefined}
              />
            </View>
          }
          // A loaded, empty list: not an error, nothing to retry.
          ListEmptyComponent={<EmptyState title="هنوز دوستی اینجا نیست" />}
          renderItem={({ item }) => {
            const ramp = friendRamp(item.slug)
            const tagline = shortPersonality(item.personality)
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.personality ? `${item.name_persian}، ${item.personality}` : item.name_persian}
                style={{ width: cardW }}
                onPress={() => open(item.slug)}
              >
                {({ pressed }) => (
                  <ClaySurface ramp={ramp} tone="soft" pressed={pressed} radius={radii.lg} style={styles.fill} faceStyle={styles.cardFace}>
                    {/* The friend at home: their scene as the stage, the
                        character standing on its ground. Decorative. */}
                    <View
                      style={[styles.stage, { height: stageH, borderColor: ramp.bright }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <SceneBackdrop scene={isSceneSlug(item.home_scene) ? item.home_scene : 'garden'} style={SCENE_FILL} />
                      </View>
                      <FriendAvatar character={item} size={art} ramp={ramp} emotion="happy" />
                    </View>
                    <Text style={[styles.name, { color: ramp.ink }]} numberOfLines={2}>{item.name_persian}</Text>
                    {tagline ? <Text style={styles.tagline} numberOfLines={2}>{tagline}</Text> : null}
                  </ClaySurface>
                )}
              </Pressable>
            )
          }}
        />
      </View>
      <BottomNav />
    </ScreenBackground>
  )
}

// SceneBackdrop rounds its own corners (16); inside a clipped stage it must not.
const SCENE_FILL = [StyleSheet.absoluteFill, { borderRadius: 0 }]
// The card face's padding around the stage: the stage's corners (md) then
// sit concentric with the card's (lg = md + 8).
const STAGE_PAD = spacing.sm

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: spacing.md, gap: GAP },
  // RoomBand is full bleed: out of the grid's side gutters.
  bandWrap: { marginHorizontal: -spacing.md, marginBottom: spacing.xs },
  // Row items stretch to the tallest card; `fill` + the face's flex: 1 carry
  // that height down to the clay face (same pattern as Home's cards).
  fill: { flex: 1 },
  cardFace: { flex: 1, padding: STAGE_PAD, paddingBottom: GAP, alignItems: 'center', gap: spacing.xs },
  stage: {
    alignSelf: 'stretch', borderRadius: radii.md, borderWidth: 2, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'flex-end', marginBottom: spacing.xs,
  },
  name: { fontSize: textSize.body, fontFamily: fonts.display, textAlign: 'center' },
  // colors.text on every ramp's soft face (>=10:1), not muted.
  tagline: { fontSize: textSize.caption, fontFamily: fonts.medium, color: colors.text, textAlign: 'center' },
})
