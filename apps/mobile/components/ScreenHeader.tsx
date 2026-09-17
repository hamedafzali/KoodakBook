import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { colors, fonts } from '@/lib/theme'

/**
 * The back-arrow + title + subtitle row duplicated near-identically across
 * ~25 mobile screens (each with its own copy of styles.header/back/title/
 * subtitle -- found in the 2026-09-17 second parity-pass audit). One shared
 * component so a font/spacing/color fix lands everywhere at once instead of
 * drifting screen by screen, the way fonts.display (Baloo) had.
 *
 * `variant="child"` (default) uses the Baloo display face for the title, per
 * DESIGN_CHARTER.md -- child-facing headings only. `variant="parent"` stays
 * on Vazirmatn bold throughout, matching web's calmer parent app.
 */
export default function ScreenHeader({
  title, subtitle, variant = 'child', onBack, right,
}: {
  title: string
  subtitle?: string
  variant?: 'child' | 'parent'
  /** Defaults to router.back(); override for a screen that needs router.replace instead. */
  onBack?: () => void
  /** Optional trailing element (e.g. a settings icon) on the header's far side. */
  right?: ReactNode
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack ?? (() => router.back())} hitSlop={10}>
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
