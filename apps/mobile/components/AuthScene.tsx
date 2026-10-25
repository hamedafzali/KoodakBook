import { useEffect, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo, Platform, StyleSheet, Text, TextInput, View, useWindowDimensions,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import type { EmotionName } from 'pixel-wizards-charachters'
import { CharacterArt } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { SvgSparkle } from '@/components/Illustrations'
import {
  colors, fonts, radii, ramps, scenery, spacing, textSize, textStart, ui,
} from '@/lib/theme'

/* ── Auth / entry scene (2026-09-28 visual-fidelity pass) ────────────────────
 *
 * The entry screens (login, signup, onboarding) open on the same illustrated
 * world as Home's hero: cream sky, the sun, clouds, the far/mid/near hill
 * bands and grass in the scenery tokens, two round trees, and ONE cast
 * character standing on the ground line -- with Home's approved wordmark
 * («کودک‌بوک», display cut in the brand ink) at the top reading start. The
 * form sits below on a warm sheet (AuthSheet) with labelled clay-edged
 * fields (AuthField). Before this, login/signup drew a separate small
 * emoji-sprinkled book/balloon vignette in web's AuthShell colours, over
 * ScreenBackground's floating emoji, with placeholder-only inputs.
 *
 *   AuthHero    full-bleed scene + wordmark + character. `motif` adds the
 *               screen's own touch to the shared sky: 'sun' (login), a book
 *               balloon (signup, web's signup motif), a path (onboarding).
 *   AuthSheet   the form's surface: surfaceSoft, radii.xl top corners,
 *               overlapping the hero's ground a little, safe-area bottom.
 *   AuthField   visible label (also the accessibility label), white face,
 *               clay bottom edge, brand ring on focus, error ring + message.
 *               TextInput keeps textAlign 'right' (it does not swap under RTL,
 *               theme.ts textStart); pass align="center" for codes and PINs.
 *   AuthNote    an inline error / info line, announced on iOS.
 *
 * All art is decorative (hidden from screen readers); the sheet's title is
 * the screen's header.
 */

// The scene's art colours beyond the scenery tokens: the same tree, trunk
// and shadow greens/browns as LaunchScreen's and Home's scene (the mockup's
// own literals; no token names them).
const ART = {
  trunk: '#8A5A24', leafDark: '#0E6244', leaf: '#127A55', leafLight: '#159C69', leafHi: '#35C08C',
  shadow: '#0F5C4A', bird: scenery.faint, petal: '#F472B6', petalCore: '#FFE9A8',
}

export type AuthMotif = 'sun' | 'balloon' | 'path'

function Tree({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G>
      <Ellipse cx={x} cy={y + 2} rx={16 * s} ry={3.6 * s} fill={ART.shadow} opacity={0.13} />
      <Rect x={x - 4.8 * s} y={y - 33 * s} width={9.6 * s} height={33 * s} rx={4.8 * s} fill={ART.trunk} />
      <Circle cx={x} cy={y - 45 * s} r={20.4 * s} fill={ART.leaf} />
      <Circle cx={x - 13.2 * s} cy={y - 35.4 * s} r={12.6 * s} fill={ART.leafDark} />
      <Circle cx={x + 12 * s} cy={y - 36.6 * s} r={11.4 * s} fill={ART.leafLight} />
      <Circle cx={x - 7.2 * s} cy={y - 54.6 * s} r={9 * s} fill={ART.leafHi} opacity={0.55} />
    </G>
  )
}

function Flower({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <G opacity={0.9}>
      {[[0, 0], [-3.2, 0], [3.2, 0], [0, -3.2], [0, 3.2]].map(([dx, dy], i) => (
        <Circle key={i} cx={x + dx} cy={y + dy} r={2.6} fill={c} />
      ))}
      <Circle cx={x} cy={y} r={1.8} fill={ART.petalCore} />
    </G>
  )
}

function Cloud({ x, y, s, o }: { x: number; y: number; s: number; o: number }) {
  return (
    <G fill={colors.card} opacity={o}>
      <Rect x={x} y={y} width={72 * s} height={19 * s} rx={9.5 * s} />
      <Circle cx={x + 18 * s} cy={y} r={15 * s} />
      <Circle cx={x + 39 * s} cy={y - 8 * s} r={20 * s} />
      <Circle cx={x + 60 * s} cy={y + 1 * s} r={13 * s} />
    </G>
  )
}

/** The scene itself: 390x240, anchored to the bottom (the ground line never
 *  moves; a taller hero shows more sky, a wider one more hills). */
function Scene({ motif }: { motif: AuthMotif }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 390 240" preserveAspectRatio="xMidYMax slice">
      <Defs>
        <LinearGradient id="kbAuthSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={scenery.sky} />
          <Stop offset="1" stopColor={scenery.sky2} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="390" height="240" fill="url(#kbAuthSky)" />

      {/* Sun / balloon at the physical LEFT: the wordmark takes the top
          right (the reading start under RTL), as on Home's hero. */}
      {motif === 'balloon' ? (
        // Web's signup motif: a hot-air balloon carrying books.
        <G transform="translate(-248 0)">
          <Path d="M318 34c-26 0-40 19-40 36 0 21 21 32 30 45h20c9-13 30-24 30-45 0-17-14-36-40-36z" fill={ramps.lessons.bright} />
          <Path d="M318 34c-10 0-16 21-16 36 0 20 7 34 11 45h10c4-11 11-25 11-45 0-15-6-36-16-36z" fill={ramps.brand.bright} />
          <Path d="M308 115l-4 16M328 115l4 16" stroke={ART.trunk} strokeWidth="2" strokeLinecap="round" />
          <Rect x="300" y="130" width="36" height="20" rx="5" fill={ramps.phonics.deep} />
          <Rect x="305" y="123" width="8" height="10" rx="2" fill={ramps.letters.bright} />
          <Rect x="314" y="121" width="8" height="12" rx="2" fill={ramps.speak.bright} />
          <Rect x="323" y="123" width="8" height="10" rx="2" fill={ramps.review.bright} />
        </G>
      ) : (
        <G>
          <Circle cx="66" cy="62" r="46" fill={ramps.brand.bright} opacity={0.16} />
          <Circle cx="66" cy="62" r="30" fill={ramps.brand.bright} />
        </G>
      )}

      <Path d="M132 44 q6 -4.5 12 0 q6 -4.5 12 0" fill="none" stroke={ART.bird} strokeWidth="2.6" strokeLinecap="round" opacity={0.5} />
      <Path d="M170 24 q4.4 -3.3 8.8 0 q4.4 -3.3 8.8 0" fill="none" stroke={ART.bird} strokeWidth="2" strokeLinecap="round" opacity={0.4} />
      <Cloud x={288} y={122} s={0.9} o={0.9} />
      <Cloud x={112} y={112} s={0.6} o={0.6} />
      <SvgSparkle cx={60} cy={142} r={8} opacity={0.95} />
      <SvgSparkle cx={262} cy={150} r={6} opacity={0.95} />

      <Path d="M0 150 q84 -52 172 -14 q92 40 182 -6 q20 -10 36 -4 L390 240 L0 240 Z" fill={scenery.far} />
      <Path d="M0 176 q100 -54 200 -10 q104 46 190 -6 L390 240 L0 240 Z" fill={scenery.mid} />
      {motif === 'path' ? (
        // Onboarding: a path winding toward the hills (the journey begins).
        <Path d="M232 240 C 226 214 180 206 196 184 C 208 168 250 166 268 150" fill="none" stroke={scenery.soil} strokeWidth="14" strokeLinecap="round" />
      ) : null}
      <Path d="M0 204 q120 -42 236 -4 q88 28 154 -10 L390 240 L0 240 Z" fill={scenery.near} />
      <Tree x={44} y={206} s={1} />
      <Tree x={350} y={214} s={0.8} />
      <Flower x={120} y={222} c={ART.petal} />
      <Flower x={276} y={226} c={ramps.review.bright} />
      <Ellipse cx="195" cy="222" rx="62" ry="9" fill={ART.shadow} opacity={0.13} />
      <Path d="M0 230 q52 -14 100 -3 q44 10 88 -3 q50 -12 98 -2 q46 11 104 -5 L390 240 L0 240 Z" fill={scenery.grass} />
    </Svg>
  )
}

export function AuthHero({
  character, emotion = 'happy', motif = 'sun',
}: {
  character: string
  emotion?: EmotionName
  motif?: AuthMotif
}) {
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  // A third of a phone, never so tall the form starts below the fold on a
  // 568pt screen, never so short the character can't stand in it.
  const sceneH = Math.round(Math.min(250, Math.max(150, winH * 0.27)))
  const art = Math.round(sceneH * 0.6)
  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.sm, height: sceneH + insets.top + spacing.lg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Scene motif={motif} />
      </View>
      <View style={styles.heroTop}>
        {/* Home's approved wordmark, exactly (app/home.tsx styles.wordmark:
            display cut, h2, brand ink). A logotype, so its text-size growth
            is capped (WCAG 1.4.4 exempts logos). */}
        <Text style={styles.wordmark} numberOfLines={1} maxFontSizeMultiplier={1.3} accessibilityLabel="کودک‌بوک">کودک‌بوک</Text>
        <Text style={styles.tagline} maxFontSizeMultiplier={1.3}>هر شب یک قصه‌ی فارسی</Text>
      </View>
      {/* Standing on the ground line, centred (symmetric, so RTL-safe). */}
      <View style={[styles.charRow, { bottom: spacing.lg + 2 }]} pointerEvents="none">
        <CharacterArt character={character} emotion={emotion} size={art} />
      </View>
    </View>
  )
}

export function AuthSheet({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }, style]}>
      <View style={styles.sheetInner}>{children}</View>
    </View>
  )
}

/** The sheet's heading: a display-weight title (the screen's header for
 *  screen readers) and an optional lead line. */
export function AuthTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {lead ? <Text style={styles.lead}>{lead}</Text> : null}
    </View>
  )
}

export function AuthField({
  label, error, align = 'right', style, onFocus, onBlur, ...input
}: TextInputProps & {
  label: string
  error?: string | null
  /** 'center' for a code/PIN; text fields keep 'right' (the reading start). */
  align?: 'right' | 'center'
  style?: StyleProp<ViewStyle>
}) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={ui.textMuted}
        accessibilityLabel={label}
        {...input}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        style={[
          styles.input,
          align === 'center' && styles.inputCenter,
          focused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      />
    </View>
  )
}

/** Inline status under a form: errors in ui.error with a mark (never colour
 *  alone), announced on iOS (live regions are Android-only). */
export function AuthNote({ text, tone = 'error' }: { text: string; tone?: 'error' | 'info' }) {
  useEffect(() => {
    if (tone === 'error' && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text)
  }, [text, tone])
  const color = tone === 'error' ? ui.error : ui.text
  return (
    <View style={[styles.note, tone === 'error' ? styles.noteError : styles.noteInfo]} accessibilityLiveRegion="polite">
      <Icon name={tone === 'error' ? 'close' : 'sparkle'} color={color} size={16} strokeWidth={2.4} />
      <Text style={[styles.noteText, { color }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { overflow: 'hidden', paddingHorizontal: spacing.md },
  heroTop: { gap: 0 },
  wordmark: { fontFamily: fonts.display, fontSize: textSize.h2, color: ramps.brand.ink, textAlign: textStart },
  tagline: { fontFamily: fonts.medium, fontSize: textSize.caption, color: colors.text, textAlign: textStart },
  charRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  sheet: {
    flexGrow: 1, marginTop: -spacing.lg, backgroundColor: ui.surfaceSoft,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    borderTopWidth: 2, borderColor: scenery.line,
    paddingTop: spacing.lg, paddingHorizontal: spacing.md + 4,
  },
  sheetInner: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: spacing.md, alignItems: 'stretch' },
  titleBlock: { gap: 2, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: textSize.h2, color: scenery.ink, textAlign: 'center' },
  lead: { fontFamily: fonts.medium, fontSize: textSize.small, color: colors.text, textAlign: 'center' },
  field: { gap: spacing.xs + 2 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: textSize.caption, color: colors.text, textAlign: textStart },
  // A white clay face: hairline sides, a deeper bottom edge (the child app's
  // material, pressed flat), brand ring on focus.
  input: {
    minHeight: 56, backgroundColor: colors.card, borderRadius: radii.md,
    borderWidth: 2, borderColor: ui.track, borderBottomWidth: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: 17, fontFamily: fonts.regular, color: colors.text, textAlign: 'right',
  },
  inputCenter: { textAlign: 'center', fontSize: textSize.cardTitle, letterSpacing: 1 },
  inputFocused: { borderColor: ramps.brand.bright, borderBottomColor: ramps.brand.deep },
  inputError: { borderColor: ui.error, borderBottomColor: ui.error },
  note: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radii.sm, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.sm,
  },
  noteError: { backgroundColor: ui.errorSoft },
  noteInfo: { backgroundColor: ramps.brand.soft },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: textSize.caption + 1, textAlign: textStart },
})
