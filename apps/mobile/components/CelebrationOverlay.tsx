import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Confetti from '@/components/Confetti'
import { playComplete } from '@/lib/uiSound'

/**
 * Drop this into any "done" screen's render tree (it renders confetti as an
 * absolute overlay, so placement in the JSX doesn't matter) to get the same
 * celebration web fires on every completion screen (`celebrate()` +
 * `playComplete()`): lesson, review, phonics quiz, counting/digits/bazaar,
 * memory. Before this, only the marpele board had any celebration at all;
 * every other "done" screen was static text with no sound or confetti
 * (2026-09-20 audit, systemic finding -- UX #12/#22, UI #10).
 *
 * Fires the sound once, on mount -- callers should mount this component only
 * when the done/completion state first becomes true (e.g. inside the same
 * conditional branch that renders the completion screen), not on every
 * render of an always-mounted screen.
 *
 * Reduce motion (2026-09-29): Confetti renders nothing while the system
 * setting is on (useReduceMotion); the completion sound still plays.
 */
export default function CelebrationOverlay({ count }: { count?: number }) {
  useEffect(() => {
    playComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Decorative: without the wrapper a screen reader could land on and read
  // out each of the ~22 falling emoji. The screen's own «آفرین!» header
  // carries the words.
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Confetti count={count} />
    </View>
  )
}
