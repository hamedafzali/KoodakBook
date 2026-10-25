import { useEffect } from 'react'
import { AccessibilityInfo, ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native'
import { Icon } from '@/components/Icon'
import { ParentButton, ParentHeader, ParentPage, parentUI } from '@/components/ParentUI'
import { fonts, radii, spacing, textSize, ui } from '@/lib/theme'

/** The api client's own wording when a request fails without a message. */
export const PARENT_FALLBACK_ERROR = 'اتصال برقرار نشد. دوباره تلاش کنید'

/**
 * Loading / failed-to-load page for a parent screen, in the parent register
 * (components/ParentUI.tsx: flat cream page, bold type; the child app's clay
 * LoadState is for children). Keeps the screen's header -- back, title and
 * the «والدین» lock badge -- so the page never changes shape when the data
 * lands, and a failed load always has a way back. `onRetry` must clear the
 * screen's error before it refetches (this then shows the spinner again, so a
 * second tap can't double-fetch).
 */
export default function ParentLoadState({ title, subtitle, error, onRetry }: {
  title: string
  subtitle?: string
  error: string | null
  onRetry?: () => void
}) {
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error)
  }, [error])
  return (
    <ParentPage>
      <ParentHeader title={title} subtitle={subtitle} />
      <View style={styles.center}>
        {error ? (
          <View style={styles.box} accessibilityLiveRegion="polite">
            <View style={styles.iconDisc}>
              <Icon name="refresh" color={ui.error} size={24} />
            </View>
            <Text style={styles.error}>{error}</Text>
            {onRetry && <ParentButton label="دوباره تلاش کنید" onPress={onRetry} style={styles.retry} />}
          </View>
        ) : (
          <ActivityIndicator color={parentUI.accentText} accessibilityLabel="در حال بارگذاری" />
        )}
      </View>
    </ParentPage>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  box: { alignItems: 'center', gap: spacing.md - 2, maxWidth: 320, alignSelf: 'stretch' },
  iconDisc: {
    width: 52, height: 52, borderRadius: radii.pill, backgroundColor: ui.errorSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  error: { color: ui.error, fontFamily: fonts.medium, fontSize: textSize.small, textAlign: 'center', lineHeight: 24 },
  retry: { alignSelf: 'stretch' },
})
