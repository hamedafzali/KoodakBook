import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import type { EmotionName } from 'pixel-wizards-charachters'
import { HostAvatar } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { goBack } from '@/lib/navigation'
import { colors, fonts, scenery, spacing, textSize, textStart, ui, type Ramp } from '@/lib/theme'

/**
 * The back-arrow + title + subtitle row duplicated near-identically across
 * ~25 mobile screens (each with its own copy of styles.header/back/title/
 * subtitle -- found in the 2026-09-17 second parity-pass audit). One shared
 * component so a font/spacing/color fix lands everywhere at once instead of
 * drifting screen by screen, the way fonts.display used to.
 *
 * `variant="child"` (default) uses Vazirmatn's 900 display weight for the
 * title, per docs/design-system.md -- child-facing headings only.
 * `variant="parent"` stays on Vazirmatn bold (700) throughout, matching
 * web's calmer parent app.
 *
 * Back is guarded by default (`goBack`, lib/navigation.ts): a screen calling
 * `router.back()` with nothing behind it in the stack crashes with "The
 * action 'GO_BACK' was not handled by any navigator" (2026-09-22 nav-safety
 * audit -- hit live in dev). `fallback` is where this header lands if that
 * happens; it defaults per `variant` since most parent screens' natural home
 * is the parent hub, not the child one. A screen with a more specific parent
 * (a math sub-game whose real home is `/math`, not `/home`) should pass its
 * own `fallback` instead of accepting the variant default.
 *
 * Child variant = Home's header voice (2026-09-27 design-system pass): title
 * in the display cut at h2 in scenery.ink (Home's child name), subtitle in
 * medium 15 colors.text (Home's greeting lines), back as a white 44pt disc
 * labelled «برگشت». `right` takes a HostAvatar (the room's host, 52pt) or a
 * small status; prefer the host's art to an emoji at the end of `title`.
 *
 * 2026-09-28 (visual-fidelity sprint): back is the Icon set's back arrow
 * (points right, toward the reading start, under RTL) instead of a «→»
 * character, and `host` is the one-line way to put the room's host at the
 * header's far end -- `host={{ ramp, character }}` draws the same 52pt
 * HostAvatar every room header uses (decorative). `right` still wins when
 * both are given, and is kept from shrinking so it lines up screen to screen.
 */
export default function ScreenHeader({
  title, subtitle, variant = 'child', onBack, fallback, right, host, style, titleEmoji, leading,
}: {
  title: string
  /** A decorative emoji shown after the title but NOT read aloud (put it
   *  here instead of inside `title`). Capped at 1.2x text scale. */
  titleEmoji?: string
  /** Decorative element between the back disc and the title (e.g. a small
   *  HostAvatar); hidden from screen readers -- the title carries the words. */
  leading?: ReactNode
  subtitle?: string
  variant?: 'child' | 'parent'
  /** Overrides the guarded default entirely -- for a screen that needs
   *  router.replace (or something else) unconditionally, not just as a
   *  no-history fallback. */
  onBack?: () => void
  /** Where to land if there's no screen to go back to. Defaults to '/parent'
   *  for variant="parent", '/home' otherwise. Ignored when `onBack` is set. */
  fallback?: string
  /** Optional trailing element (e.g. a settings icon) on the header's far side. */
  right?: ReactNode
  /** The room's host disc at the far end (52pt HostAvatar, decorative);
   *  ignored when `right` is set. */
  host?: { ramp: Ramp; character?: string; emoji?: string; emotion?: EmotionName; size?: number }
  /** Layout overrides for the row. A header placed INSIDE a scroll view that
   *  already pads its content sideways passes `{ paddingHorizontal: 0 }`, so
   *  the back disc lines up with the cards below instead of sitting a second
   *  inset further in. */
  style?: StyleProp<ViewStyle>
}) {
  const defaultFallback = variant === 'parent' ? '/parent' : '/home'
  return (
    <View style={[styles.header, variant === 'child' && styles.headerChild, style]}>
      <Pressable
        onPress={onBack ?? (() => goBack(fallback ?? defaultFallback))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="برگشت"
        style={variant === 'child' ? styles.backHit : undefined}
      >
        {({ pressed }) => (variant === 'child' ? (
          <View style={[styles.backDisc, pressed && styles.pressed]}>
            <Icon name="back" color={scenery.ink} size={22} strokeWidth={2.5} />
          </View>
        ) : (
          <View style={[styles.backParent, pressed && styles.pressed]}>
            <Icon name="back" color={colors.muted} size={24} />
          </View>
        ))}
      </Pressable>
      {/* flex: 1 + minWidth 0: a long title or subtitle wraps inside the
          space left by the back disc and `right`, never under or past them. */}
      {leading ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{leading}</View>
      ) : null}
      <View style={styles.textCol}>
        {titleEmoji ? (
          <View style={styles.titleRow}>
            <Text style={[styles.title, variant === 'child' && styles.titleChild, styles.titleShrink]} accessibilityRole="header">{title}</Text>
            <Text
              style={[styles.title, variant === 'child' && styles.titleChild]}
              maxFontSizeMultiplier={1.2}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {titleEmoji}
            </Text>
          </View>
        ) : (
          <Text style={[styles.title, variant === 'child' && styles.titleChild]} accessibilityRole="header">{title}</Text>
        )}
        {/* Ternary, not &&: an empty-string subtitle would render a bare string. */}
        {subtitle ? <Text style={[styles.subtitle, variant === 'child' && styles.subtitleChild]}>{subtitle}</Text> : null}
      </View>
      {right ? (
        <View style={styles.end}>{right}</View>
      ) : host ? (
        <View style={styles.end}>
          <HostAvatar ramp={host.ramp} size={host.size ?? 52} character={host.character} emoji={host.emoji} emotion={host.emotion ?? 'happy'} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  // Child screens pad their content by spacing.md (Home's body, every list and
  // grid); the header now shares that edge instead of sitting 4pt further in.
  headerChild: { paddingHorizontal: spacing.md },
  textCol: { flex: 1, minWidth: 0 },
  // A row mirrors under RTL: the emoji follows the title at its reading end.
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  titleShrink: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
  backParent: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  end: { flexShrink: 0 },
  // textStart: the title column is flex: 1, so on iOS the default alignment
  // put Persian titles at the physical left, away from the back arrow.
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text, textAlign: textStart },
  // Child headers speak Home's language (app/home.tsx): the display cut in
  // scenery.ink for the title, a white 44pt disc for back (the same disc as
  // Home's avatar), and colors.text rather than muted for the subtitle --
  // muted measures 4.46:1 on the page gradient's darker end.
  titleChild: { fontFamily: fonts.display, fontSize: textSize.h2, color: scenery.ink },
  subtitleChild: { fontFamily: fonts.medium, fontSize: textSize.small, color: colors.text },
  // The disc is already 44pt; this keeps the Pressable itself that size so the
  // row can't squeeze it when a long title wraps.
  backHit: { minWidth: ui.hit, minHeight: ui.hit, flexShrink: 0 },
  backDisc: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card,
    borderWidth: 2, borderColor: scenery.line, alignItems: 'center', justifyContent: 'center',
  },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2, textAlign: textStart },
})
