import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useReduceMotion } from '@/components/Confetti'
import { Cloud, RewardStar, Sparkle } from '@/components/Illustrations'
import { page } from '@/lib/theme'

/**
 * The app's background layer. Web has a whole language for this (soft warm
 * child-bg gradient, amber hero, illustrated auth panels); mobile screens were
 * a flat fill. This gives every screen a warm gradient base, plus an optional
 * playful layer (translucent blobs + slowly drifting motifs) for "moment"
 * screens — login, signup, onboarding, placement, home.
 */
export type BgVariant = 'warm' | 'amber' | 'green'

const GRADIENTS: Record<BgVariant, [string, string, string]> = {
  // Soft honey — the everyday child background (web's child-bg, a touch richer).
  // Read from theme `page` (same three stops as before) so the splash, the
  // navigator card and this gradient can't drift apart again.
  warm: page.gradient,
  // Brand identity — login "welcome back".
  amber: ['#FBBF24', '#F59E0B', '#F97316'],
  // Fresh — signup "new adventure".
  green: ['#34D399', '#10B981', '#0D9488'],
}

// Drawn motifs (components/Illustrations.tsx), not emoji: an emoji renders
// per-platform and off-palette (2026-09-29, Agent J's art audit). Same
// positions, sizes (~the old glyph box) and opacity as the emoji they replace;
// the old 🌙 is a second, smaller sparkle (the art set has no moon).
type MotifKind = 'star' | 'sparkle' | 'cloud'
interface FloatSpec { kind: MotifKind; top: number; left?: number; right?: number; size: number; delay: number; range: number }

const MOTIFS: FloatSpec[] = [
  { kind: 'star', top: 80, left: 28, size: 22, delay: 0, range: 8 },
  { kind: 'sparkle', top: 150, right: 36, size: 18, delay: 900, range: 6 },
  { kind: 'cloud', top: 240, left: 44, size: 36, delay: 400, range: 10 },
  { kind: 'sparkle', top: 60, right: 30, size: 14, delay: 1300, range: 7 },
]

function Motif({ kind, size }: { kind: MotifKind; size: number }) {
  if (kind === 'star') return <RewardStar size={size} face={false} />
  if (kind === 'cloud') return <Cloud size={size} />
  return <Sparkle size={size} />
}

function Floating({ spec, tint, still }: { spec: FloatSpec; tint: boolean; still: boolean }) {
  const y = useRef(new Animated.Value(0)).current
  useEffect(() => {
    // Reduce motion (or not known yet): the motif stays put.
    if (still) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 2600, delay: spec.delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still])
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [0, -spec.range] })
  return (
    <Animated.View
      style={{
        position: 'absolute', top: spec.top, left: spec.left, right: spec.right,
        opacity: tint ? 0.7 : 0.5, transform: [{ translateY }],
      }}
    >
      <Motif kind={spec.kind} size={spec.size} />
    </Animated.View>
  )
}

export default function ScreenBackground({
  variant = 'warm', decor = false, style, children,
}: {
  variant?: BgVariant
  decor?: boolean
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}) {
  const onColor = variant !== 'warm'   // decor tints differ on colored panels
  const reduceMotion = useReduceMotion()
  return (
    <View style={[styles.root, style]}>
      <LinearGradient colors={GRADIENTS[variant]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {decor && (
        // Decorative: hidden from screen readers as one block.
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* Soft translucent blobs for depth */}
          <View style={[styles.blob, { width: 180, height: 180, top: -50, right: -40, backgroundColor: onColor ? 'rgba(255,255,255,0.14)' : 'rgba(251,191,36,0.10)' }]} />
          <View style={[styles.blob, { width: 130, height: 130, bottom: 60, left: -36, backgroundColor: onColor ? 'rgba(255,255,255,0.10)' : 'rgba(249,115,22,0.08)' }]} />
          {MOTIFS.map((m, i) => (
            <Floating key={i} spec={m} tint={onColor} still={reduceMotion !== false} />
          ))}
        </View>
      )}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999 },
})
