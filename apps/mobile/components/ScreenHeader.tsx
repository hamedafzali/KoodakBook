import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { goBack } from '@/lib/navigation'
import { colors, fonts } from '@/lib/theme'

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
 */
export default function ScreenHeader({
  title, subtitle, variant = 'child', onBack, fallback, right,
}: {
  title: string
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
}) {
  const defaultFallback = variant === 'parent' ? '/parent' : '/home'
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack ?? (() => goBack(fallback ?? defaultFallback))} hitSlop={10}>
        <Text style={styles.back}>→</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, variant === 'child' && styles.titleChild]}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  titleChild: { fontFamily: fonts.display },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
})
