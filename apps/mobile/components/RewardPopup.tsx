import { useEffect, useRef } from 'react'
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import type { Badge } from '@koodakbook/shared'
import { mediaUrl } from '@/lib/media'
import { colors, fonts } from '@/lib/theme'

interface Props {
  badge: Badge
  onClose: () => void
}

/** Mobile take on web's RewardPopup: badge card springs in, auto-closes in 5s. */
export default function RewardPopup({ badge, onClose }: Props) {
  const scale = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start()
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Text style={styles.confetti}>🎉</Text>
          {mediaUrl(badge.image_url) ? (
            <Image source={{ uri: mediaUrl(badge.image_url)! }} style={styles.image} contentFit="contain" />
          ) : (
            <Text style={styles.fallback}>🏅</Text>
          )}
          <Text style={styles.title}>{badge.title}</Text>
          {badge.description && <Text style={styles.description}>{badge.description}</Text>}
          <Text style={styles.hint}>آفرین! 👏</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  card: {
    backgroundColor: colors.card, borderRadius: 28, padding: 28,
    alignItems: 'center', gap: 10, width: '100%', maxWidth: 340,
  },
  confetti: { fontSize: 40 },
  image: { width: 120, height: 120 },
  fallback: { fontSize: 80 },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  description: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  hint: { fontSize: 16, fontFamily: fonts.medium, color: colors.success, marginTop: 6 },
})
