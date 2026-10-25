import { useEffect, useRef } from 'react'
import { AccessibilityInfo, Animated, Modal, Platform, Pressable, StyleSheet, Text } from 'react-native'
import { Image } from 'expo-image'
import type { Badge } from '@koodakbook/shared'
import { RewardStar, Sparkle } from '@/components/Illustrations'
import { mediaUrl } from '@/lib/media'
import { colors, elevation, fonts, radii, scenery, spacing, textSize, ui } from '@/lib/theme'

interface Props {
  badge: Badge
  onClose: () => void
}

/** Mobile take on web's RewardPopup: badge card springs in, auto-closes in 5s.
 *
 *  Accessibility (2026-09-26): the whole popup is one control -- tapping
 *  anywhere closes it, as before -- so it is ONE labelled button: its label is
 *  the reward itself and its hint says a tap closes it. iOS moves VoiceOver
 *  focus into the modal and reads that label, which is the announcement;
 *  Android's TalkBack doesn't reliably focus a new Modal, so it gets the same
 *  words announced once on mount. Never both. */
export default function RewardPopup({ badge, onClose }: Props) {
  const scale = useRef(new Animated.Value(0)).current
  const spoken = `نشان جدید گرفتی: ${badge.title}${badge.description ? `، ${badge.description}` : ''}. آفرین!`

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start()
    if (Platform.OS === 'android') AccessibilityInfo.announceForAccessibility(spoken)
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint="برای بستن ضربه بزنید"
        accessibilityViewIsModal
        style={styles.backdrop}
        onPress={onClose}
      >
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          {/* Drawn art, not emoji (2026-09-29): a twinkle over the badge,
              and the reward star when the badge has no picture. Both
              decorative -- the button's label says the reward. */}
          <Sparkle size={36} />
          {mediaUrl(badge.image_url) ? (
            <Image source={{ uri: mediaUrl(badge.image_url)! }} style={styles.image} contentFit="contain" />
          ) : (
            <RewardStar size={96} />
          )}
          <Text style={styles.title}>{badge.title}</Text>
          {/* Ternary, not &&: an empty-string description would render a bare string. */}
          {badge.description ? <Text style={styles.description}>{badge.description}</Text> : null}
          <Text style={styles.hint}>آفرین! 👏</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: ui.scrim,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  card: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 28,
    alignItems: 'center', gap: 10, width: '100%', maxWidth: 340, ...elevation.modal,
  },
  image: { width: 120, height: 120 },
  // The child heading voice (display cut, scenery.ink), same as LoadState's
  // and the done screens' titles.
  title: { fontSize: textSize.h2, fontFamily: fonts.display, color: scenery.ink, textAlign: 'center' },
  description: { fontSize: textSize.small, fontFamily: fonts.regular, color: colors.text, textAlign: 'center' },
  // Lessons ink, not colors.success: #22c55e on white is ~2.3:1.
  hint: { fontSize: textSize.body, fontFamily: fonts.bold, color: ui.success, marginTop: spacing.xs + 2 },
})
