import { useEffect } from 'react'
import { AccessibilityInfo, ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native'
import type { EmotionName } from 'pixel-wizards-charachters'
import { CharacterArt, ClayButton, TextButton } from '@/components/Clay'
import { colors, fonts, ramps, scenery, spacing, textSize, ui, type Ramp } from '@/lib/theme'

/**
 * The loading / failed-to-load body for a screen that fetches before it can
 * show anything. Screens used to render only the error text here, with no way
 * out but leaving the screen (2026-09-25 hardening sprint), so every such
 * screen now gets the same recovery: the message, a retry and, on screens
 * without the bottom nav, a way back.
 *
 * `onRetry` must clear the screen's error before it refetches: that swaps
 * this back to the spinner at once, so the retry button is gone and a second
 * tap can't start a duplicate request. No automatic retries.
 *
 * Same art, copy and button as Home's error state (app/home.tsx): سیمرغ
 * (encouraging), the display title, the reason, the brand ClayButton.
 *
 * Three states, three components -- a screen should never show one as another:
 *   loading   LoadState with error=null: Home's spinner, or loading="character"
 *             for web's LoadingScreen (چرخی, the cast's "waiting" character)
 *             on a full-screen wait.
 *   failed    LoadState with the error message.
 *   empty     EmptyState (below): the load worked and there is nothing yet.
 */
export default function LoadState({
  error, onRetry, onBack, title = 'نتونستیم صفحه رو بیاریم',
  character = 'simorgh', emotion = 'encouraging', loading = 'spinner', loadingMessage = 'یک لحظه صبر کن…',
}: {
  error: string | null
  /** Omit when retrying can't help (something that doesn't exist). */
  onRetry?: () => void
  /** For screens with no bottom nav (a lesson, a story, a friend). */
  onBack?: () => void
  title?: string
  /** The error's art (a cast slug), null for none. 'thinking' suits "not
   *  found"; the default matches Home's error. */
  character?: string | null
  emotion?: EmotionName
  /** 'character': چرخی over the spinner with `loadingMessage` (a full-screen
   *  wait); 'spinner' (default): the bare spinner Home uses. */
  loading?: 'spinner' | 'character'
  loadingMessage?: string
}) {
  // The error replaces the spinner in place, with no focus change, so a
  // screen-reader user wouldn't know the load failed. Android speaks the
  // block through its live region below; iOS has no live regions, so it is
  // announced once per error here instead (never both).
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`${title}. ${error}`)
  }, [error, title])

  if (!error) {
    if (loading === 'character') {
      return (
        <View
          style={styles.wrap}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={loadingMessage}
          accessibilityState={{ busy: true }}
        >
          <CharacterArt character="charkhi" emotion="thinking" size={100} />
          <ActivityIndicator size="small" color={colors.onPrimary} />
          <Text style={styles.body}>{loadingMessage}</Text>
        </View>
      )
    }
    return <ActivityIndicator size="large" color={colors.onPrimary} accessibilityLabel="در حال بارگذاری" />
  }
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      {character ? <CharacterArt character={character} emotion={emotion} size={120} /> : null}
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.body}>{error}</Text>
      {onRetry ? <ClayButton ramp={ramps.brand} label="دوباره امتحان کن" icon="refresh" onPress={onRetry} style={styles.button} /> : null}
      {onBack ? <TextButton label="برگشت" onPress={onBack} /> : null}
    </View>
  )
}

/**
 * "Nothing here yet" -- the load succeeded and the list is empty (no stories
 * of my own, no friends yet, no badges). Distinct from LoadState's error: no
 * live region, no retry, calm art. Words say what the child can do; the
 * optional action does it (a bright ClayButton on `ramp`, default brand).
 * Art is decorative; the title is a header.
 */
export function EmptyState({
  title, body, character = 'simorgh', emotion = 'happy', artSize,
  actionLabel, onAction, ramp = ramps.brand, compact = false,
}: {
  title: string
  body?: string
  /** A cast slug (lib/characterSvg.ts); null for no art in a tight spot. */
  character?: string | null
  emotion?: EmotionName
  /** Defaults to 104 (72 when compact). */
  artSize?: number
  actionLabel?: string
  onAction?: () => void
  ramp?: Ramp
  /** Inside a scroll list/section: smaller art, tighter padding and gaps. */
  compact?: boolean
}) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {character ? <CharacterArt character={character} emotion={emotion} size={artSize ?? (compact ? 72 : 104)} /> : null}
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? <ClayButton ramp={ramp} label={actionLabel} onPress={onAction} style={styles.button} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 360, alignSelf: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: textSize.cardTitle, color: scenery.ink, textAlign: 'center' },
  // colors.text, not colors.danger: danger measures 4.4-4.5:1 on the page
  // backgrounds, right at the AA edge for 15pt text.
  body: { fontFamily: fonts.regular, fontSize: textSize.small, color: ui.text, textAlign: 'center' },
  button: { alignSelf: 'stretch' },
  wrapCompact: { gap: spacing.sm, padding: spacing.md },
})
