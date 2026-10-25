import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

/**
 * Real icon-in-chip treatment for the parent area, replacing raw emoji used
 * as menu/stat icons (2026-09-20 audit, UX #17 / UI #5 — "the single most
 * systemic charter violation"). DESIGN_CHARTER.md sanctions emoji for
 * child-facing UI specifically; the parent area is required to stay calmer
 * and use real icons instead. Dark ink (`primaryDeep`) on a soft fill
 * (`primarySoft`) by default, matching the same dark-ink-on-soft-fill rule
 * used everywhere else in the token system — never white on a soft chip.
 */
export default function IconChip({
  name, size = 36, iconSize = 18, tone = 'primary',
}: {
  name: keyof typeof Ionicons.glyphMap
  size?: number
  iconSize?: number
  /** 'primary' (default amber chip) or 'danger' (red chip, e.g. logout). */
  tone?: 'primary' | 'danger'
}) {
  const bg = tone === 'danger' ? colors.dangerSoft : colors.primarySoft
  const fg = tone === 'danger' ? colors.danger : colors.primaryDeep
  return (
    // Decorative: the row it sits in carries the words (an icon font glyph
    // would otherwise be read as an unknown character).
    <View
      style={[styles.chip, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={name} size={iconSize} color={fg} />
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
})
