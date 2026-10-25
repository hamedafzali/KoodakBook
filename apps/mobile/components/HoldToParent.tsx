import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { router } from 'expo-router'
import { Icon } from '@/components/Icon'
import { colors, fonts, radii, spacing, textSize, ui } from '@/lib/theme'

// Web's ParentDoorNav rule: kids can find the door, only a deliberate ~0.7s
// press-and-hold opens it (a tap does nothing but show the hint). The visible
// fill makes "hold it" discoverable. The PIN gate is still the real lock.
const HOLD_MS = 700

export default function HoldToParent({ style, children, accessibilityLabel }: {
  style?: StyleProp<ViewStyle>
  children: ReactNode
  /** What the door says to screen readers. Without it the label is built
   *  from the children's text, emoji and all -- pass one (e.g. «بخش والدین»). */
  accessibilityLabel?: string
}) {
  const progress = useRef(new Animated.Value(0)).current
  const finishedRef = useRef(false)
  const [hint, setHint] = useState(false)
  // The hint's hide timer, cleared on unmount so a tap right before leaving
  // the screen doesn't set state afterwards. The hold itself is unchanged.
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Unmount: stop a hold in progress (its callback then sees finished=false)
  // and refuse any late completion, so leaving the screen mid-hold can never
  // open the parent area afterwards (QA P3, 2026-09-27).
  const mountedRef = useRef(true)
  useEffect(() => {
    // Set on every mount, not just in the ref's initial value: StrictMode and
    // Fast Refresh replay effects (cleanup, then this again) on the same refs.
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      progress.stopAnimation()
      if (hintTimer.current) clearTimeout(hintTimer.current)
    }
  }, [progress])

  function start() {
    finishedRef.current = false
    setHint(false)
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, useNativeDriver: false }).start(({ finished }) => {
      if (!mountedRef.current) return
      progress.setValue(0)
      if (finished) {
        finishedRef.current = true
        router.push('/parent')
      }
    })
  }

  function cancel() {
    progress.stopAnimation(() => progress.setValue(0))
    if (!finishedRef.current) {
      setHint(true)
      if (hintTimer.current) clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setHint(false), 1600)
    }
  }

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Pressable
        onPressIn={start}
        onPressOut={cancel}
        style={[styles.button, style]}
        // A button to assistive tech (it was a generic element on iOS), and
        // the hold is announced: VoiceOver/TalkBack users hold with a
        // double-tap-and-hold. Label = the children's text, as before.
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="برای ورود، دو بار ضربه بزنید و نگه دارید"
      >
        <Animated.View
          style={[
            styles.fill,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
        {children}
      </Pressable>
      {/* Polite live region: TalkBack reads the hint when a tap brings it up. */}
      {/* The lock is a decorative line Icon (was a 🔒 emoji), so only the
          words are spoken. The row puts it at the text's reading end. */}
      {hint && (
        <View style={styles.hintRow}>
          <Text style={styles.hint} accessibilityLiveRegion="polite" accessibilityLabel="برای والدین — نگه دارید">
            برای والدین — نگه دارید
          </Text>
          <Icon name="lock" color={ui.text} size={12} strokeWidth={2.5} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, paddingVertical: 8, paddingHorizontal: 12,
  },
  // RTL: react-native lays 'left' as the start edge, so the fill grows from the right
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: ui.highlight },
  // colors.text, not muted: the hint sits on the page gradient, where muted
  // measures ~4.4:1 at the darker end -- under AA for 11pt text.
  hint: { fontSize: textSize.micro, fontFamily: fonts.regular, color: ui.text },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
})
