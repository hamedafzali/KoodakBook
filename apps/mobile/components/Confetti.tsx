import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native'

/**
 * A burst of falling emoji confetti -- mobile's equivalent of web's
 * lib/confetti.ts `celebrate()`. Originally built inline inside
 * MarpeleBoard.tsx for the board-game win screen only; extracted here
 * (2026-09-20 audit, Phase 3) so every completion screen (lesson, review,
 * phonics, math games, memory) can share one component instead of each
 * screen inventing its own, or -- as was actually the case -- having none
 * at all.
 */
const CONFETTI = ['🎉', '⭐', '🎈', '✨', '🏅']

export default function Confetti({ count = 22 }: { count?: number }) {
  const { width } = useWindowDimensions()
  const pieces = useRef(
    Array.from({ length: count }, () => ({
      x: Math.random() * width,
      emoji: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
      delay: Math.random() * 600,
      size: 18 + Math.random() * 16,
      fall: new Animated.Value(0),
    }))
  ).current

  useEffect(() => {
    Animated.stagger(40, pieces.map((p) =>
      Animated.timing(p.fall, { toValue: 1, duration: 2200, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: true })
    )).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const translateY = p.fall.interpolate({ inputRange: [0, 1], outputRange: [-40, 700] })
        const rotate = p.fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] })
        const opacity = p.fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] })
        return (
          <Animated.Text key={i} style={{ position: 'absolute', left: p.x, fontSize: p.size, opacity, transform: [{ translateY }, { rotate }] }}>
            {p.emoji}
          </Animated.Text>
        )
      })}
    </View>
  )
}
