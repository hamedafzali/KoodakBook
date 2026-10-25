import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native'

/**
 * The system "Reduce Motion" setting (iOS) / "Remove animations" (Android),
 * live: null until the first read resolves, then true/false, updated when
 * the setting changes. Decorative motion (confetti, drifting motifs) waits
 * for `false` before it starts, so a reduce-motion user never sees a frame of
 * it (2026-09-29). Feedback that isn't motion (sounds, text) is unaffected.
 */
export function useReduceMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (live) setReduce(v) })
      .catch(() => { if (live) setReduce(false) })
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduce(v))
    return () => { live = false; sub.remove() }
  }, [])
  return reduce
}

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
  const reduce = useReduceMotion()
  const { width, height } = useWindowDimensions()
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
    // Reduce motion (or not known yet): no falling pieces at all.
    if (reduce !== false) return
    const anim = Animated.stagger(40, pieces.map((p) =>
      Animated.timing(p.fall, { toValue: 1, duration: 2200, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: true })
    ))
    anim.start()
    return () => anim.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce])

  if (reduce !== false) return null
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const translateY = p.fall.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] })
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
