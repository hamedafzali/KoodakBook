import { useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { router } from 'expo-router'
import { colors, fonts } from '@/lib/theme'

// Web's ParentDoorNav rule: kids can find the door, only a deliberate ~0.7s
// press-and-hold opens it (a tap does nothing but show the hint). The visible
// fill makes "hold it" discoverable. The PIN gate is still the real lock.
const HOLD_MS = 700

export default function HoldToParent({ style, children }: {
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const progress = useRef(new Animated.Value(0)).current
  const finishedRef = useRef(false)
  const [hint, setHint] = useState(false)

  function start() {
    finishedRef.current = false
    setHint(false)
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, useNativeDriver: false }).start(({ finished }) => {
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
      setTimeout(() => setHint(false), 1600)
    }
  }

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Pressable onPressIn={start} onPressOut={cancel} style={[styles.button, style]}>
        <Animated.View
          style={[
            styles.fill,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
        {children}
      </Pressable>
      {hint && <Text style={styles.hint}>برای والدین — نگه دارید 🔒</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, paddingVertical: 8, paddingHorizontal: 12,
  },
  // RTL: react-native lays 'left' as the start edge, so the fill grows from the right
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#fde68a' },
  hint: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
})
