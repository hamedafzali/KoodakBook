import { useCallback, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import Svg, { Circle, Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { setActiveChildId, clearActiveChildId } from '@/lib/activeChild'
import HoldToParent from '@/components/HoldToParent'
import { mediaUrl } from '@/lib/media'
import { colors, fonts, radii, ramps, scenery, spacing, textSize, textStart, type Ramp } from '@/lib/theme'
import LoadState, { EmptyState } from '@/components/LoadState'
import ScreenBackground from '@/components/ScreenBackground'
import { CharacterArt, ClaySurface } from '@/components/Clay'
import Icon from '@/components/Icon'
import SceneBackdrop from '@/components/SceneBackdrop'

/*
 * «کی داره می‌خونه؟» -- the child picker. 2026-09-25 visual convergence with
 * Home (visuals and accessibility only; pick, logout and the HoldToParent
 * gate are unchanged): warm page gradient, سیمرغ greeting over the title,
 * each child a soft clay card with the same avatar/initial disc as Home's
 * avatar button (ramps.stories) and the name in the display cut.
 *
 * 2026-09-27 (release readiness; pick/logout/gate semantics unchanged):
 *  - The list reloads on focus: a child added in the parent area
 *    (app/parent/children.tsx, reached from this screen's gate) is there on
 *    the way back instead of after a relaunch. A failed refresh keeps the
 *    list already shown.
 *  - The empty copy sent families to the website; the parent area here can
 *    add a child, so it now points at the gate below.
 *  - A photo that fails to load falls back to the initial disc instead of
 *    an empty ring. No stand-in photos.
 *  - The title's 👋 and the gate's 🔒 were read aloud as part of the text:
 *    the wave is a separate hidden Text (this centred title isn't a
 *    ScreenHeader), the lock Home's SVG lock, and the gate carries its own
 *    label.
 *
 * 2026-09-28 visual fidelity (pick/logout/gate semantics and labels unchanged):
 *  - Head: سیمرغ standing in his own sky scene (a rounded window, like the
 *    friends band), the title in the display cut with a short lead line
 *    under it; the hidden 👋 is gone.
 *  - Each child is a clay row in their own colour (a stable pick from a few
 *    ramps by the child's id, so a family's cards don't all look alike and a
 *    child keeps theirs), avatar/initial disc at the reading start, the name
 *    in the display cut, and Home's «go» disc (Icon chevron) at the end.
 *  - The grown-ups' way out sits apart under a hairline: a quiet white pill
 *    (Icon lock + «حالت والدین», HoldToParent unchanged) and the logout link.
 */
const GAP = spacing.sm + spacing.xs
const AVATAR = 64
// The children's colours. Warm and distinct; each measured for ink on soft
// and on bright (lib/theme.ts ramps).
const CHILD_RAMPS: Ramp[] = [ramps.stories, ramps.phonics, ramps.review, ramps.lessons, ramps.letters, ramps.speak]
/** A stable ramp for a child: from their id, not their position, so adding
 *  a sibling doesn't repaint everyone. */
function childRamp(id: string): Ramp {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return CHILD_RAMPS[Math.abs(h) % CHILD_RAMPS.length]
}

export default function Children() {
  const insets = useSafeAreaInsets()
  const { width: winW } = useWindowDimensions()
  const guideArt = Math.round(Math.min(120, winW * 0.3))
  const [children, setChildren] = useState<Child[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }

  useFocusEffect(useCallback(() => {
    let cancelled = false
    api.get<Child[]>('/api/children').then((res) => {
      if (cancelled) return
      if (res.data) setChildren(res.data)
      // A response with no message must still leave the spinner. (Shown
      // only while nothing is loaded; a failed refresh keeps the list.)
      else setError(res.error ?? 'اتصال برقرار نشد. دوباره تلاش کن')
    })
    return () => { cancelled = true }
  }, [reloadKey]))

  // One pick or logout at a time: a double tap (or two cards tapped in quick
  // succession) used to write the active child twice and replace to /home
  // twice. This screen is replaced on success, so the lock only resets when
  // SecureStore fails and the child needs to be able to tap again.
  const busy = useRef(false)

  async function pick(child: Child) {
    if (busy.current) return
    busy.current = true
    try {
      await setActiveChildId(child.id)
      router.replace('/home')
    } catch {
      busy.current = false
    }
  }

  async function logout() {
    if (busy.current) return
    busy.current = true
    try {
      await api.post('/api/auth/logout', {})
      await clearToken()
      await clearActiveChildId()
      router.replace('/login')
    } catch {
      busy.current = false
    }
  }

  if (!children) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={error} onRetry={retry} />
        </View>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
        <FlatList
          data={children}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.head}>
              {/* سیمرغ at home in his sky; decorative. */}
              <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <SceneBackdrop scene="sky" style={SCENE_FILL} />
                </View>
                <CharacterArt character="simorgh" emotion="happy" size={guideArt} />
              </View>
              <Text style={styles.title} accessibilityRole="header">کی داره می‌خونه؟</Text>
              {children.length > 0 && <Text style={styles.lead}>اسمت رو پیدا کن و بزن!</Text>}
            </View>
          }
          // سیمرغ is already over the title: no second character here.
          ListEmptyComponent={
            <EmptyState
              character={null}
              title="هنوز کودکی ثبت نشده"
              body="بزرگ‌ترها از «حالت والدین» پایین همین صفحه یک پروفایل کودک بسازند."
            />
          }
          renderItem={({ item }) => {
            const ramp = childRamp(item.id)
            return (
              <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => pick(item)}>
                {({ pressed }) => (
                  <ClaySurface ramp={ramp} tone="soft" pressed={pressed} radius={radii.lg} faceStyle={styles.cardFace}>
                    {/* Home's avatar button: pale disc, bright rim, photo or initial. */}
                    <ChildAvatar child={item} ramp={ramp} />
                    <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                    {/* Home's «go» disc; the card is the button. */}
                    <View style={[styles.go, { backgroundColor: ramp.bright }]}>
                      <Icon name="chevron" color={ramp.ink} size={20} strokeWidth={3} />
                    </View>
                  </ClaySurface>
                )}
              </Pressable>
            )
          }}
        />
        {/* The grown-ups' corner: apart from the children's cards, quiet. */}
        <View style={styles.footer}>
          <HoldToParent style={styles.parentButton} accessibilityLabel="حالت والدین">
            <View style={styles.parentRow}>
              <Icon name="lock" color={ramps.review.ink} size={20} />
              <Text style={styles.parentButtonText}>حالت والدین</Text>
            </View>
          </HoldToParent>
          <Pressable accessibilityRole="button" accessibilityLabel="خروج از حساب" onPress={logout} hitSlop={8} style={styles.logoutHit}>
            <Text style={styles.logout}>خروج از حساب</Text>
          </Pressable>
        </View>
      </View>
    </ScreenBackground>
  )
}

// SceneBackdrop rounds its own corners (16); inside the clipped stage it must not.
const SCENE_FILL = [StyleSheet.absoluteFill, { borderRadius: 0 }]
const PERSON_PATH = 'M4 21a8 8 0 0 1 16 0z'

/** Home's avatar disc: the child's real photo, else their initial. A photo
 *  that fails to load drops to the initial. Decorative (the card's label is
 *  the name). */
function ChildAvatar({ child, ramp }: { child: Child; ramp: Ramp }) {
  const uri = mediaUrl(child.avatar_url)
  const [failed, setFailed] = useState(false)
  // Array.from: the first code point, never half a surrogate pair.
  const initial = Array.from((child.name ?? '').trim())[0]
  return (
    <View style={[styles.avatar, { backgroundColor: ramp.soft, borderColor: ramp.bright }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {uri && !failed ? (
        <Image source={{ uri }} style={styles.avatarImage} contentFit="cover" onError={() => setFailed(true)} />
      ) : initial ? (
        // Fixed to the disc (decorative); the name beside it scales.
        <Text style={[styles.avatarInitial, { color: ramp.ink }]} maxFontSizeMultiplier={1}>{initial}</Text>
      ) : (
        // No photo and no name to take an initial from: a plain person
        // glyph, not a cast character (the child isn't one).
        <Svg viewBox="0 0 24 24" width={AVATAR / 2} height={AVATAR / 2}>
          <Circle cx={12} cy={8} r={4} fill={ramp.ink} />
          <Path d={PERSON_PATH} fill={ramp.ink} />
        </Svg>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  // سیمرغ's window: full width, rounded like the cards, art on the ground.
  stage: {
    alignSelf: 'stretch', minHeight: 140, borderRadius: radii.lg, borderWidth: 2, borderColor: scenery.line,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: { fontSize: textSize.h1, fontFamily: fonts.display, color: scenery.ink, textAlign: 'center' },
  lead: { fontSize: textSize.small, fontFamily: fonts.medium, color: colors.text, textAlign: 'center' },
  list: { gap: GAP, paddingVertical: spacing.sm },
  // A row: the avatar sits at the reading start (the right under RTL).
  cardFace: { flexDirection: 'row', alignItems: 'center', gap: GAP, padding: GAP, minHeight: 88 },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: radii.pill,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage: { width: AVATAR, height: AVATAR },
  avatarInitial: { fontFamily: fonts.display, fontSize: textSize.h2 },
  name: { flex: 1, fontSize: textSize.cardTitle, fontFamily: fonts.display, color: scenery.ink, textAlign: textStart },
  go: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  // The grown-ups' corner, set apart by a hairline.
  footer: {
    alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md,
    borderTopWidth: 2, borderTopColor: scenery.line,
  },
  // Styling only; HoldToParent's own hold/PIN behaviour is untouched.
  parentButton: {
    alignSelf: 'center', backgroundColor: colors.card, borderRadius: radii.pill,
    borderWidth: 2, borderColor: scenery.line, minHeight: 44,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  parentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  parentButtonText: { fontSize: textSize.small, fontFamily: fonts.medium, color: colors.text },
  logoutHit: { minHeight: 44, justifyContent: 'center' },
  logout: { color: colors.text, fontFamily: fonts.medium, textAlign: 'center', fontSize: textSize.small, textDecorationLine: 'underline' },
})
