import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { ramps, scenery, type Ramp } from '@/lib/theme'

/**
 * KoodakBook's small illustration set (Agent J, visual-fidelity sprint,
 * 2026-09-28): the reference design's reward star, gift box, parent-area
 * lock badge, story-card play badge, sparkle, cloud and a short "MiniScene"
 * strip for secondary-screen headers.
 *
 * Style: the same premium-flat language as the Home hero scene
 * (CONTINUE_SCENE_SVG in app/home.tsx) and the pixel-wizards cast -- flat
 * fills, one darker "core shadow" layer for volume, one soft highlight, no
 * outlines, no gradients (no gradient ids to collide between instances).
 * Hand-authored paths only; no rasters, no emoji glyphs.
 *
 * A11y: decorative by default (hidden from screen readers, like
 * CharacterArt) -- the control or text next to it carries the words. Pass
 * `label` only for a standalone meaningful picture.
 *
 * RTL: the art is never mirrored (scenes and objects read the same in both
 * directions); place it with flow layout, never absolute left/right.
 */

/** Art-only shades that have no theme token. Base hues come from ramps /
 *  scenery so the set follows the design system. */
const ART = {
  starShade: '#F59E0B',
  starLight: '#FDE68A',
  cheek: '#FB7185',
  giftBody: '#3B82F6',
  giftShade: '#2563EB',
  giftLid: '#60A5FA',
  ribbonShade: '#D97706',
  white: '#FFFFFF',
  /** Default twinkle: amber, 1.96:1 on page.base (#FFF3DE), 1.84:1 on the
   *  gradient's darkest stop -- visible as a decorative mark on the cream
   *  page (the old #FFD98A was 1.23:1 and nearly vanished). */
  sparkle: '#F59E0B',
  tree: '#127A55',
  treeDark: '#0E6244',
  trunk: '#8A5A24',
  shadow: '#0F5C4A',
} as const

type ArtProps = {
  /** Rendered size in pt (square). */
  size?: number
  /** Makes the art meaningful to screen readers (otherwise decorative). */
  label?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Shared wrapper: fixed square box + the decorative/labelled a11y switch. */
function Art({ size, label, style, testID, viewBox = '0 0 100 100', children }: ArtProps & {
  size: number; viewBox?: string; children: ReactNode
}) {
  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
  return (
    <View {...a11y} testID={testID} style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={viewBox}>{children}</Svg>
    </View>
  )
}

// Rounded five-point star, centre (50,54), R 46 / r 23, soft tips.
const STAR = 'M47.8 12.4Q50 8 52.2 12.4L62.2 32.7Q63.5 35.4 66.5 35.8L88.9 39.1Q93.7 39.8 90.2 43.2L74.1 59Q71.9 61.1 72.4 64.1L76.2 86.4Q77 91.2 72.7 88.9L52.7 78.4Q50 77 47.3 78.4L27.3 88.9Q23 91.2 23.8 86.4L27.6 64.1Q28.1 61.1 25.9 59L9.8 43.2Q6.3 39.8 11.1 39.1L33.5 35.8Q36.5 35.4 37.8 32.7Z'

/** The reference's friendly reward star: golden, smiling, rosy cheeks.
 *  `face={false}` gives a plain golden star (dense rows, rating strips). */
export function RewardStar({ size = 48, face = true, ...rest }: ArtProps & { face?: boolean }) {
  return (
    <Art size={size} {...rest}>
      <G transform="translate(0 3)"><Path d={STAR} fill={ART.starShade} /></G>
      <Path d={STAR} fill={ramps.brand.bright} />
      <Path d="M44 20Q50 12 53 20L57 29Q46 30 38 38Q39 28 44 20Z" fill={ART.starLight} opacity={0.8} />
      {face && (
        <G>
          <Ellipse cx="41" cy="54" rx="3.4" ry="4.4" fill={scenery.ink} />
          <Ellipse cx="59" cy="54" rx="3.4" ry="4.4" fill={scenery.ink} />
          <Circle cx="42.2" cy="52.4" r="1.3" fill={ART.white} />
          <Circle cx="60.2" cy="52.4" r="1.3" fill={ART.white} />
          <Ellipse cx="33.5" cy="62" rx="4.6" ry="3" fill={ART.cheek} opacity={0.45} />
          <Ellipse cx="66.5" cy="62" rx="4.6" ry="3" fill={ART.cheek} opacity={0.45} />
          <Path d="M43 62.5Q50 70.5 57 62.5Q50 65.5 43 62.5Z" fill={scenery.ink} />
        </G>
      )}
    </Art>
  )
}

/** The reference's reward gift: blue box, golden ribbon and bow. */
export function GiftBox({ size = 48, ...rest }: ArtProps) {
  return (
    <Art size={size} {...rest}>
      <Ellipse cx="50" cy="91" rx="34" ry="4" fill={ART.shadow} opacity={0.12} />
      {/* bow loops (behind the lid) */}
      <Path d="M50 30C38 6 16 8 22 22C26 31 40 32 50 30Z" fill={ramps.brand.bright} />
      <Path d="M50 30C62 6 84 8 78 22C74 31 60 32 50 30Z" fill={ramps.brand.bright} />
      <Path d="M50 30C42 20 32 17 28 21C32 27 42 29 50 30Z" fill={ART.ribbonShade} opacity={0.5} />
      <Path d="M50 30C58 20 68 17 72 21C68 27 58 29 50 30Z" fill={ART.ribbonShade} opacity={0.5} />
      {/* box */}
      <Rect x="18" y="44" width="64" height="44" rx="6" fill={ART.giftBody} />
      <Rect x="60" y="44" width="22" height="44" rx="6" fill={ART.giftShade} opacity={0.6} />
      <Rect x="12" y="30" width="76" height="18" rx="6" fill={ART.giftLid} />
      <Rect x="16" y="33" width="30" height="4" rx="2" fill={ART.white} opacity={0.45} />
      {/* ribbon */}
      <Rect x="44" y="30" width="12" height="58" fill={ramps.brand.bright} />
      <Rect x="51" y="30" width="5" height="58" fill={ART.ribbonShade} opacity={0.35} />
      <Circle cx="50" cy="30" r="6" fill={ramps.brand.bright} />
    </Art>
  )
}

/** The reference's parent-area badge: a white padlock on a soft disc.
 *  Defaults to the review ramp's violet (the reference's lavender). */
export function ParentLock({ size = 56, ramp = ramps.review, ...rest }: ArtProps & { ramp?: Ramp }) {
  return (
    <Art size={size} {...rest}>
      <Circle cx="50" cy="50" r="48" fill={ramp.bright} />
      <Circle cx="50" cy="50" r="48" fill={ramp.deep} opacity={0.12} />
      <Path d="M18 36Q30 10 60 8Q34 16 24 44Z" fill={ART.white} opacity={0.18} />
      <Path d="M37 46V38a13 13 0 0 1 26 0v8" fill="none" stroke={ART.white} strokeWidth="7" strokeLinecap="round" />
      <Rect x="29" y="44" width="42" height="32" rx="9" fill={ART.white} />
      <Circle cx="50" cy="57" r="4.5" fill={ramp.deep} />
      <Rect x="48" y="58" width="4" height="9" rx="2" fill={ramp.deep} />
    </Art>
  )
}

/** The reference's story-card play button: white disc, ink triangle, soft
 *  drop shadow. Media glyph: never mirrored. `color` tints the triangle. */
export function PlayBadge({ size = 36, color = scenery.ink, ...rest }: ArtProps & { color?: string }) {
  return (
    <Art size={size} {...rest}>
      <Circle cx="50" cy="54" r="44" fill={scenery.ink} opacity={0.14} />
      <Circle cx="50" cy="50" r="44" fill={ART.white} />
      <Path d="M41 33.5v33a3 3 0 0 0 4.5 2.6l26-16.5a3 3 0 0 0 0-5.2l-26-16.5A3 3 0 0 0 41 33.5Z" fill={color} />
    </Art>
  )
}

const SPARKLE = 'M50 6Q55 45 94 50Q55 55 50 94Q45 55 6 50Q45 45 50 6Z'

/** In-SVG sparkle (see SvgCloud). */
export function SvgSparkle({ cx, cy, r, color = ART.sparkle, opacity = 1 }: {
  cx: number; cy: number; r: number; color?: string; opacity?: number
}) {
  const k = r / 44
  return (
    <G transform={`translate(${cx - 50 * k} ${cy - 50 * k}) scale(${k})`} opacity={opacity}>
      <Path d={SPARKLE} fill={color} />
    </G>
  )
}

/** Four-point twinkle (the Home scene's sparkles). */
export function Sparkle({ size = 20, color = ART.sparkle, ...rest }: ArtProps & { color?: string }) {
  return (
    <Art size={size} {...rest}>
      <Path d={SPARKLE} fill={color} />
    </Art>
  )
}

/** In-SVG pieces for art that already has its own <Svg> (SceneBackdrop's
 *  floating clouds, AuthScene's stars): a 60x30 cloud at (x,y) scaled by
 *  `s`, and a 4-point sparkle centred on (cx,cy) with radius r. Use these in
 *  place of emoji SvgText (☁️ ✨ ⭐), which renders per-platform. */
export function SvgCloud({ x = 0, y = 0, s = 1, opacity = 0.95 }: { x?: number; y?: number; s?: number; opacity?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity} fill={ART.white}>
      <Rect x="0" y="14" width="60" height="16" rx="8" />
      <Circle cx="16" cy="16" r="12" />
      <Circle cx="33" cy="11" r="15" />
      <Circle cx="50" cy="18" r="10" />
    </G>
  )
}

/** A single puffy cloud (the Home scene's cloud), 2:1. `size` is the width. */
export function Cloud({ size = 60, label, style, testID }: ArtProps) {
  const h = Math.round(size / 2)
  return (
    <View
      {...(label
        ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })}
      testID={testID}
      style={[{ width: size, height: h }, style]}
    >
      <Svg width={size} height={h} viewBox="-2 -4 64 34"><SvgCloud /></Svg>
    </View>
  )
}

/**
 * A short illustrated strip for secondary-screen headers: the Home hero's
 * sky, clouds, layered hills and grass line in miniature, so every room
 * opens with the same world. Stretches to its container's width (slice-fit
 * from the bottom: the hills always meet the bottom edge). Decorative.
 * Put it BEHIND the header (absolute fill in a relative wrapper, or as the
 * first child of a column); keep text off the bottom ~40% (the hills).
 *
 * `ramp` tints it for a room: the sky runs from the room's soft stop into
 * Home's sky and the back hill takes the room's bright colour; the front
 * hills and grass stay Home's greens, so every room still reads as the
 * same world. Without `ramp` it is Home's own palette.
 */
export function MiniScene({ height = 84, sun = false, trees = true, ramp, style, testID }: {
  height?: number
  /** Draw a sun (top-left). Off by default: Home's hero no longer has one. */
  sun?: boolean
  /** Draw the two small trees at the ends. */
  trees?: boolean
  /** Room tint (see above). */
  ramp?: Ramp
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  // Id derived from the colours: two strips with the same ramp share an
  // identical definition, so a shared id (web DOM) can't mis-tint either.
  const skyId = ramp ? `kbMiniSky${ramp.soft.slice(1)}` : ''
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
      style={[{ width: '100%', height, overflow: 'hidden' }, style]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 360 84" preserveAspectRatio="xMidYMax slice">
        {ramp ? (
          <>
            <Defs>
              <LinearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ramp.soft} />
                <Stop offset="1" stopColor={scenery.sky} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="360" height="84" fill={`url(#${skyId})`} />
          </>
        ) : (
          <>
            <Rect x="0" y="0" width="360" height="84" fill={scenery.sky} />
            <Rect x="0" y="42" width="360" height="42" fill={scenery.sky2} />
          </>
        )}
        {sun && (
          <G>
            <Circle cx="40" cy="22" r="20" fill={ramps.brand.bright} opacity={0.18} />
            <Circle cx="40" cy="22" r="13" fill={ramps.brand.bright} />
          </G>
        )}
        <Path d="M150 12Q151 17 156 18Q151 19 150 24Q149 19 144 18Q149 17 150 12Z" fill={ART.sparkle} opacity={0.85} />
        <Path d="M298 36Q298.8 39.2 302 40Q298.8 40.8 298 44Q297.2 40.8 294 40Q297.2 39.2 298 36Z" fill={ART.white} />
        <SvgCloud x={228} y={4} s={0.8} />
        <SvgCloud x={92} y={22} s={0.5} opacity={0.8} />
        <Path
          d="M0 50q70 -22 140 -6q72 18 146 -4q40 -12 74 2V84H0Z"
          fill={ramp ? ramp.bright : scenery.far}
          opacity={ramp ? 0.55 : 1}
        />
        <Path d="M0 62q88 -26 184 -4q96 22 176 -4V84H0Z" fill={scenery.mid} />
        <Path d="M0 72q110 -18 214 -2q84 14 146 -4V84H0Z" fill={scenery.near} />
        {trees && (
          <G>
            <Rect x="23" y="52" width="6" height="18" rx="3" fill={ART.trunk} />
            <Circle cx="26" cy="46" r="12" fill={ART.tree} />
            <Circle cx="18" cy="51" r="7.5" fill={ART.treeDark} />
            <Rect x="330" y="54" width="5" height="15" rx="2.5" fill={ART.trunk} />
            <Circle cx="332.5" cy="49" r="10" fill={ART.tree} />
            <Circle cx="339" cy="53" r="6" fill={ART.treeDark} />
          </G>
        )}
        <Path d="M0 79q46 -8 88 -2q38 6 78 -2q44 -8 86 0q40 6 108 -3V84H0Z" fill={scenery.grass} />
      </Svg>
    </View>
  )
}
