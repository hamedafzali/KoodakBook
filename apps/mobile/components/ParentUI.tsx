import { useEffect, type ReactNode } from 'react'
import {
  AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Ionicons } from '@expo/vector-icons'
import { Icon } from '@/components/Icon'
import IconChip from '@/components/IconChip'
import { goBack } from '@/lib/navigation'
import { colors, fonts, radii, spacing, textSize, textStart, ui } from '@/lib/theme'

/* ── The parent register (2026-09-28 visual-fidelity pass) ───────────────────
 *
 * The parent area is an adult utility inside a children's app: same typeface
 * (Vazirmatn, but bold -- never the 900 display cut), same radii and spacing
 * tokens, the same brand saffron as its one accent, on a flat, quieter cream
 * page with white cards and hairline borders. No clay edges, no characters,
 * no emoji as icons. Before this each parent screen hand-built its own header
 * (a bare «→» glyph), cards (radius 18, off the radii scale), chips, buttons
 * and inputs, with cold slate greys (#e5e7eb, #f1f5f9, #e2e8f0, #cbd5e1) and
 * several controls without an accessibility role.
 *
 *   ParentPage     the page: flat cream (parentUI.page) + safe-area top.
 *   ParentHeader   Icon back in a 44pt disc, bold title, optional subtitle,
 *                  and a «والدین» lock badge: the security cue that says
 *                  "you are in the PIN-protected area".
 *   ParentCard     white card, radii.md, hairline border.
 *   ParentButton   primary (saffron, ink label) / secondary (white, border) /
 *                  danger (red fill, white label); busy + disabled states.
 *   ParentChip     a one-of-many choice (radio) or filter, 44pt tall.
 *   ParentField    labelled TextInput (visible label = accessibility label),
 *                  textAlign 'right' (TextInput does not swap under RTL).
 *   ParentRow      a navigation row: icon chip, label, sub, Icon chevron.
 *   ParentNote     an inline status line (error / success), announced.
 *   ParentSection  a small section label over a card.
 */

export const parentUI = {
  page: colors.bg,
  surface: colors.card,
  /** Hairline on white and cream (the child app's divider, warm not slate). */
  line: ui.divider,
  /** Input and inactive-chip border: a step stronger than a divider. */
  border: ui.track,
  /** Fill of an input / inactive chip on a white card. */
  field: colors.bg,
  text: colors.text,
  /** Secondary text: ui.textMuted clears AA on cream and white alike. */
  muted: ui.textMuted,
  accent: colors.primary,
  onAccent: colors.onPrimary,
  accentSoft: colors.primarySoft,
  /** Links and icons in the accent: primaryDeep (#745300) is 6.5:1 on cream. */
  accentText: colors.primaryDeep,
  danger: colors.danger,
  /** White on #dc2626 is 4.8:1. */
  onDanger: ui.onDeep,
  radius: radii.md,
  controlRadius: radii.sm,
} as const

export function ParentPage({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets()
  return <View style={[styles.page, { paddingTop: insets.top + spacing.sm }, style]}>{children}</View>
}

export function ParentHeader({
  title, subtitle, onBack, fallback = '/parent', right, secure = true, style,
}: {
  title: string
  subtitle?: string
  /** Overrides the guarded back entirely. */
  onBack?: () => void
  /** Where back lands when nothing is behind this screen. */
  fallback?: string
  right?: ReactNode
  /** Show the «والدین» lock badge (the PIN-protected area). Off for screens
   *  also reached before sign-in (legal). */
  secure?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.header, style]}>
      <Pressable
        onPress={onBack ?? (() => goBack(fallback))}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="برگشت"
        style={({ pressed }) => [styles.backDisc, pressed && styles.pressed]}
      >
        <Icon name="back" color={parentUI.text} size={22} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      {secure ? (
        <View style={styles.lockBadge} accessible accessibilityLabel="بخش والدین، با پین محافظت می‌شود">
          <Icon name="lock" color={parentUI.accentText} size={14} strokeWidth={2.2} />
          <Text style={styles.lockText} maxFontSizeMultiplier={1.4}>والدین</Text>
        </View>
      ) : null}
    </View>
  )
}

export function ParentCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function ParentSection({ label }: { label: string }) {
  return <Text style={styles.section} accessibilityRole="header">{label}</Text>
}

export function ParentButton({
  label, onPress, tone = 'primary', busy = false, disabled = false, accessibilityLabel, accessibilityHint, style, compact = false,
}: {
  label: string
  onPress: () => void
  tone?: 'primary' | 'secondary' | 'danger'
  busy?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  /** 44pt instead of 48pt, for a button beside an input. */
  compact?: boolean
}) {
  const inert = disabled || busy
  const ink = tone === 'primary' ? parentUI.onAccent : tone === 'danger' ? parentUI.onDanger : parentUI.text
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        tone === 'primary' && styles.buttonPrimary,
        tone === 'secondary' && styles.buttonSecondary,
        tone === 'danger' && styles.buttonDanger,
        pressed && !inert && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={ink} /> : <Text style={[styles.buttonText, { color: ink }]}>{label}</Text>}
    </Pressable>
  )
}

export function ParentChip({
  label, selected, onPress, role = 'radio', accessibilityLabel,
}: {
  label: string
  selected: boolean
  onPress: () => void
  /** 'radio' for one-of-many settings; 'button' for a filter/selector. */
  role?: 'radio' | 'button' | 'tab'
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
    >
      {selected ? <Icon name="check" color={parentUI.onAccent} size={14} strokeWidth={2.6} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )
}

export function ParentField({
  label, hint, error, style, inputStyle, ...input
}: TextInputProps & {
  label: string
  hint?: string
  error?: string | null
  style?: StyleProp<ViewStyle>
  inputStyle?: TextInputProps['style']
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={parentUI.muted}
        accessibilityLabel={label}
        accessibilityHint={hint}
        {...input}
        style={[styles.input, !!error && styles.inputError, inputStyle]}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <ParentNote text={error} tone="error" /> : null}
    </View>
  )
}

export function ParentRow({
  icon, label, sub, onPress, tone = 'primary', accessibilityRole = 'button',
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  sub?: string
  onPress: () => void
  tone?: 'primary' | 'danger'
  accessibilityRole?: 'button' | 'link'
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={sub ? `${label}، ${sub}` : label}
    >
      <IconChip name={icon} size={36} iconSize={18} tone={tone} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, tone === 'danger' && { color: ui.error }]}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {tone === 'danger' ? null : <Icon name="chevron" color={parentUI.muted} size={18} />}
    </Pressable>
  )
}

export function ParentDivider() {
  return <View style={styles.divider} />
}

/** An inline status line. Errors are announced (iOS has no live regions). */
export function ParentNote({ text, tone = 'error' }: { text: string; tone?: 'error' | 'success' }) {
  useEffect(() => {
    if (tone === 'error' && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text)
  }, [text, tone])
  return (
    <View style={styles.note} accessibilityLiveRegion="polite">
      <Icon name={tone === 'error' ? 'close' : 'check'} color={tone === 'error' ? ui.error : ui.success} size={14} strokeWidth={2.6} />
      <Text style={[styles.noteText, { color: tone === 'error' ? ui.error : ui.success }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: parentUI.page },
  pressed: { opacity: 0.7 },
  disabled: { opacity: ui.disabledOpacity },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4,
    paddingHorizontal: spacing.md + 4, paddingBottom: spacing.md - 2,
  },
  backDisc: {
    width: ui.hit, height: ui.hit, borderRadius: radii.pill, flexShrink: 0,
    backgroundColor: parentUI.surface, borderWidth: 1, borderColor: parentUI.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bold, fontSize: textSize.cardTitle, color: parentUI.text, textAlign: textStart },
  subtitle: { fontFamily: fonts.regular, fontSize: textSize.caption, color: parentUI.muted, marginTop: 2, textAlign: textStart },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0,
    paddingHorizontal: spacing.sm + 2, minHeight: 28, borderRadius: radii.pill,
    backgroundColor: parentUI.accentSoft,
  },
  lockText: { fontFamily: fonts.bold, fontSize: textSize.micro, color: parentUI.accentText },
  card: {
    backgroundColor: parentUI.surface, borderRadius: parentUI.radius, padding: spacing.md,
    gap: spacing.sm + 2, borderWidth: 1, borderColor: parentUI.line,
  },
  section: {
    fontFamily: fonts.bold, fontSize: textSize.caption, color: parentUI.muted,
    marginTop: spacing.sm, marginBottom: -spacing.xs, textAlign: textStart,
  },
  button: {
    minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: parentUI.controlRadius,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonCompact: { minHeight: ui.hit, paddingHorizontal: spacing.md + 2 },
  buttonPrimary: { backgroundColor: parentUI.accent },
  buttonSecondary: { backgroundColor: parentUI.surface, borderWidth: 1, borderColor: parentUI.border },
  buttonDanger: { backgroundColor: parentUI.danger },
  buttonText: { fontFamily: fonts.bold, fontSize: textSize.small, textAlign: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    minHeight: ui.hit, paddingHorizontal: spacing.md, borderRadius: radii.pill,
    backgroundColor: parentUI.field, borderWidth: 1, borderColor: parentUI.border,
  },
  chipOn: { backgroundColor: parentUI.accent, borderColor: parentUI.accent },
  chipText: { fontFamily: fonts.medium, fontSize: textSize.caption + 1, color: parentUI.text },
  chipTextOn: { fontFamily: fonts.bold, color: parentUI.onAccent },
  field: { gap: spacing.xs + 2, alignSelf: 'stretch' },
  fieldLabel: { fontFamily: fonts.bold, fontSize: textSize.caption, color: parentUI.text, textAlign: textStart },
  fieldHint: { fontFamily: fonts.regular, fontSize: textSize.micro + 1, color: parentUI.muted, textAlign: textStart },
  input: {
    minHeight: 48, backgroundColor: parentUI.field, borderRadius: parentUI.controlRadius,
    borderWidth: 1, borderColor: parentUI.border,
    paddingHorizontal: spacing.md - 2, paddingVertical: spacing.sm + 2,
    fontSize: 16, fontFamily: fonts.regular, color: parentUI.text, textAlign: 'right',
  },
  inputError: { borderColor: ui.error },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingVertical: spacing.sm + 4, minHeight: 56 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: fonts.bold, fontSize: textSize.small, color: parentUI.text, textAlign: textStart },
  rowSub: { fontFamily: fonts.regular, fontSize: textSize.caption - 1, color: parentUI.muted, marginTop: 2, textAlign: textStart },
  divider: { height: 1, backgroundColor: parentUI.line },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'stretch' },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: textSize.caption, textAlign: textStart },
})
