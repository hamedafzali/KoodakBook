import { useState, type ReactNode } from 'react'
import { I18nManager, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import type { EmotionName } from 'pixel-wizards-charachters'
import { goBack } from '@/lib/navigation'
import { colors, fonts, iconSize, scenery, shape, spacing, textSize, textStart, ui, type Ramp } from '@/lib/theme'
import { CharacterArt, HostAvatar, ClaySurface, ProgressTrack } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { SvgCloud, SvgSparkle } from '@/components/Illustrations'

/* ── Room scenes: the learning rooms' illustrated identity ───────────────────
 *
 * Home opens on an illustrated world (app/home.tsx's hero: sky, sun, cloud,
 * three hills, a grass line). The learning rooms (lessons, speak, write,
 * phonics, and the lesson / review done cards) used to open on a bare title
 * row, so they read as a different, plainer app (2026-09-28 visual-fidelity
 * sprint). This is the same landscape language, drawn smaller and TINTED by
 * the room's ramp: the sky runs from the ramp's soft stop into Home's sky,
 * the sun and one back hill are the ramp's bright stop, the front hills and
 * grass are Home's scenery greens. So every room is recognisably Home's
 * world, and recognisably its own room -- never a copy of Home's hero.
 *
 * Art is decorative (hidden from screen readers) and never mirrored under RTL
 * (Clay.tsx's illustration rules); the host is placed by flow layout.
 * Text on the scene is ui.textStrong / colors.text only: both clear AA on
 * every sky tint and on Home's hills (colors.text >= 5.62:1, home.tsx).
 */

/** The landscape alone, filling its parent (position it absolutely). With
 *  `height` it is pinned to the parent's BOTTOM at that height instead, so a
 *  parent that grows (RoomBand with more text) grows only its sky -- paint
 *  the parent ramp.soft (the sky's top stop) behind it. */
export function RoomScene({ ramp, height, style }: { ramp: Ramp; height?: number; style?: StyleProp<ViewStyle> }) {
  // One gradient id per ramp: two scenes on screen never share a <Defs> id
  // with different colours.
  const gid = `kbRoomSky${ramp.deep.slice(1)}`
  return (
    <View
      style={[height === undefined ? StyleSheet.absoluteFill : [styles.pinned, { height }], style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* xMidYMax slice: a taller box (large text) grows the sky, and the
          hills keep hugging the bottom edge. */}
      <Svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={ramp.soft} />
            <Stop offset="1" stopColor={scenery.sky} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="400" height="200" fill={`url(#${gid})`} />
        {/* The room's sun (Home's is amber; each room's is its own hue). */}
        <Circle cx="58" cy="46" r="34" fill={ramp.bright} opacity={0.18} />
        <Circle cx="58" cy="46" r="21" fill={ramp.bright} opacity={0.75} />
        {/* Clouds and sparkles: the shared illustration set's motifs
            (components/Illustrations.tsx, Home's hero), one sparkle in the
            room's colour. */}
        <SvgCloud x={236} y={18} s={1} />
        <SvgCloud x={120} y={56} s={0.55} opacity={0.8} />
        <SvgSparkle cx={170} cy={34} r={7} color={ramp.bright} />
        <SvgSparkle cx={346} cy={72} r={5} color={colors.card} />
        {/* Hills: the room's own tint at the back, Home's greens in front. */}
        <Path d="M0 124 q80 -34 170 -10 q90 24 150 -8 q46 -20 80 -4 L400 200 L0 200 Z" fill={ramp.bright} opacity={0.35} />
        <Path d="M0 142 q96 -36 200 -8 q104 26 200 -8 L400 200 L0 200 Z" fill={scenery.far} />
        <Path d="M0 162 q120 -30 236 -4 q92 18 164 -8 L400 200 L0 200 Z" fill={scenery.mid} />
        <Path d="M0 180 q150 -18 270 -2 q70 8 130 -6 L400 200 L0 200 Z" fill={scenery.near} />
        {/* Two flowers in the room's colour on the front hill. */}
        <G opacity={0.95}>
          <Circle cx="118" cy="182" r="3" fill={ramp.bright} />
          <Circle cx="118" cy="182" r="1.4" fill={colors.card} />
          <Circle cx="300" cy="186" r="3" fill={ramp.bright} />
          <Circle cx="300" cy="186" r="1.4" fill={colors.card} />
        </G>
        <Ellipse cx="200" cy="200" rx="260" ry="10" fill={scenery.grass} />
      </Svg>
    </View>
  )
}

/**
 * A learning room's header: the room's landscape in a card-shaped window
 * (rounded bottom corners, full-bleed at the top under the status bar), with
 * back, the room's title and line at the reading start and its host standing
 * on the hills at the end (a row: first child = right under RTL).
 *
 *   tall     hubs (the lessons list): back on its own row, host 112pt.
 *   compact  practice screens (speak, write, phonics): one row, host 80pt,
 *            so the activity stays above the fold.
 *
 * `children` sits under the subtitle (a progress track, a count). A room
 * without a host shows its emoji in the white disc (Clay.tsx's Fallback).
 * Pass `topInset` (safe-area top) -- the band draws under the status bar.
 *
 * `speech` (+ optional bold `speechTitle`): the host greets the child in a
 * white speech bubble -- the Games/Math hubs' and Friends' intro (2026-09-29,
 * one header system). The band then stacks: back + title/subtitle/children on
 * the first row, and the bubble beside the host on the second, so the bubble
 * always has the row's width at 320pt and at large text, where it simply
 * wraps and grows (no line cap, no «…»). Its tail points at the host (reading
 * end: left under RTL). Words on white: ramp.ink / ui.text, both >= 7:1. The
 * bubble is one element to screen readers, read after the title. Without
 * `speech` the band renders exactly as before.
 *
 * Height is content-driven (2026-09-29, Phonics' two-line subtitle sat on
 * the hills). The landscape is drawn at the band's BASE height -- the height
 * its host row alone gives it -- pinned to the bottom, so hills, grass and
 * the host's ground never grow; any extra height (a wrapped subtitle, large
 * text, a progress pill) becomes sky above it, in ramp.soft (the sky's top
 * stop). The words (title + subtitle) always end above the hill line: under
 * them sits a footer at least HILL_LINE (scaled) tall, holding `children`
 * (a white pill may stand on the hills) and otherwise empty. At base height
 * with a progress pill (Speak, Write, Lessons) that footer is the pill
 * itself, so those bands keep their look. The speech layout's words are on
 * its first row, above the host row, so they clear the hills by layout.
 */
export function RoomBand({
  ramp, title, subtitle, character, emoji, emotion = 'happy', size = 'compact',
  topInset, fallback = '/home', onBack, speech, speechTitle, children,
}: {
  ramp: Ramp
  title: string
  subtitle?: string
  character?: string
  emoji?: string
  emotion?: EmotionName
  size?: 'tall' | 'compact'
  topInset: number
  fallback?: string
  onBack?: () => void
  /** The host's line in a white speech bubble (see above). */
  speech?: string
  /** A bold first line in the bubble, e.g. «سلام! من تندپام». Needs `speech`. */
  speechTitle?: string
  children?: ReactNode
}) {
  const tall = size === 'tall'
  // A 320pt phone keeps the title's width: the host steps down a size
  // (Home's hero art shrinks on narrow phones the same way).
  const { width, fontScale } = useWindowDimensions()
  const narrow = width < NARROW
  // With a bubble, large text also trims the host, so the bubble keeps width.
  const bigText = !!speech && fontScale >= BIG_TEXT
  const art = (tall ? TALL_ART : COMPACT_ART) - (narrow ? NARROW_TRIM : 0) - (bigText ? NARROW_TRIM : 0)
  // The band's own width (it is full-bleed in every caller; the window width
  // until the first layout).
  const [bandW, setBandW] = useState(width)
  // BASE height: what the band measures with its host row alone (see the doc
  // above). The landscape is drawn at this height, pinned to the bottom.
  const hostRow = character ? art + spacing.xs : art
  const baseH = topInset + spacing.sm + (speech || tall ? ui.hit : 0) + (speech ? spacing.sm : 0) + hostRow + spacing.sm
  // The SVG's slice scale at that size, and the hill line in pt from the
  // band's bottom edge; the footer under the words is at least that, less
  // the band's and the text column's bottom padding.
  const scale = Math.max(bandW / SCENE_W, baseH / SCENE_H)
  const footerMin = Math.max(0, Math.ceil(HILL_LINE * scale) - 2 * spacing.sm)
  const sky = (
    <>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: ramp.soft }]} pointerEvents="none" />
      <RoomScene ramp={ramp} height={baseH} />
    </>
  )
  const onLayout = (e: { nativeEvent: { layout: { width: number } } }) => {
    const w = Math.round(e.nativeEvent.layout.width)
    if (w !== bandW) setBandW(w)
  }
  const back = (
    <Pressable
      onPress={onBack ?? (() => goBack(fallback))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="برگشت"
      style={styles.backHit}
    >
      {({ pressed }) => (
        <View style={[styles.backDisc, pressed && styles.pressed]}>
          <Icon name="back" color={ui.textStrong} size={iconSize.control} strokeWidth={2.5} />
        </View>
      )}
    </Pressable>
  )
  const host = character ? (
    <View style={styles.hostStand}>
      <CharacterArt character={character} emotion={emotion} size={art} />
    </View>
  ) : (
    // Lifted clear of the grass and the band's rounded corners: the disc
    // (art - DISC_TRIM) plus this lift is exactly `art`, the row's minimum.
    <View style={styles.discStand}>
      <HostAvatar ramp={ramp} size={art - DISC_TRIM} emoji={emoji} />
    </View>
  )
  const text = (
    <>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </>
  )
  if (speech) {
    return (
      <View style={[styles.band, { paddingTop: topInset + spacing.sm }]} onLayout={onLayout}>
        {sky}
        <View style={styles.headRow}>
          {back}
          <View style={styles.headText}>{text}</View>
        </View>
        {/* A row: the bubble at the reading start, the host at the end. */}
        <View style={[styles.speechRow, { minHeight: art }]}>
          <View
            style={[styles.bubble, { borderColor: ramp.bright }]}
            accessible
            accessibilityLabel={speechTitle ? `${speechTitle} ${speech}` : speech}
          >
            <View style={[styles.bubbleTail, { borderColor: ramp.bright }]} />
            {speechTitle ? <Text style={[styles.bubbleTitle, { color: ramp.ink }]}>{speechTitle}</Text> : null}
            <Text style={styles.bubbleLine}>{speech}</Text>
          </View>
          {host}
        </View>
      </View>
    )
  }
  return (
    <View style={[styles.band, { paddingTop: topInset + spacing.sm }]} onLayout={onLayout}>
      {sky}
      {tall ? <View style={styles.topRow}>{back}</View> : null}
      <View style={[styles.mainRow, { minHeight: art }]}>
        {tall ? null : back}
        <View style={[styles.textCol, tall && styles.textColTall]}>
          <View style={[styles.words, tall && styles.wordsTall]}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {/* Keeps the words above the hill line; holds the children. */}
          <View style={{ minHeight: footerMin }}>{children}</View>
        </View>
        {host}
      </View>
    </View>
  )
}

/**
 * Progress for a room: an 8pt pill track (neutral warm, so an empty track
 * never reads as a full one -- QuizTopBar's 2026-09-28 fix) filling from the
 * reading start in the ramp's deep stop, with «۳ از ۲۰» beside it. Sits on a
 * white pill so it stays legible wherever it lands on the scene. `label` is
 * what a screen reader hears for the whole row.
 */
export function RoomProgress({ ramp, done, total, meta, label }: {
  ramp: Ramp
  done: number
  total: number
  meta: string
  label: string
}) {
  return (
    <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: Math.min(done, total) }}
    >
      {/* The shared bar (Clay.tsx); this row carries its words. */}
      <ProgressTrack value={done} total={total} ramp={ramp} decorative style={styles.track} />
      <Text style={[styles.progressMeta, { color: ramp.ink }]}>{meta}</Text>
    </View>
  )
}

/**
 * The done card every learning room ends on (lesson, review, phonics): the
 * room's landscape as a little stage with its host standing on it, proud,
 * then the verdict. Soft clay in the room's ramp, like the tiles.
 * `score` is an optional «۵ از ۶ درست» pill; `children` go under it.
 */
export function RoomDoneCard({ ramp, character, emotion = 'proud', title, body, score, style, children }: {
  ramp: Ramp
  character: string
  emotion?: EmotionName
  title: string
  body?: string
  score?: string
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}) {
  return (
    <ClaySurface ramp={ramp} tone="soft" radius={shape.hero} style={[styles.doneCard, style]} faceStyle={styles.doneFace}>
      <View style={styles.doneStage}>
        <RoomScene ramp={ramp} />
        <CharacterArt character={character} emotion={emotion} size={DONE_ART} />
      </View>
      <View style={styles.doneText}>
        <Text style={[styles.doneTitle, { color: ramp.ink }]} accessibilityRole="header">{title}</Text>
        {body ? <Text style={styles.doneBody}>{body}</Text> : null}
        {score ? (
          <View style={[styles.scorePill, { borderColor: ramp.bright }]}>
            <Icon name="star" color={ramp.deep} size={iconSize.inline + 2} filled />
            <Text style={[styles.scoreText, { color: ramp.ink }]}>{score}</Text>
          </View>
        ) : null}
        {children}
      </View>
    </ClaySurface>
  )
}

// Clay.tsx's scale rule: a focal scene character ~104pt; the tall band's
// host a little larger (it is the screen's one illustration).
const TALL_ART = 112
const COMPACT_ART = 80
// An emoji disc reads bigger than a character of the same box.
const DISC_TRIM = 16
const NARROW = 360
const NARROW_TRIM = 16
// fontScale from which a speech band trims its host (iOS "Larger Text" ~ xxxL).
const BIG_TEXT = 1.3
const DONE_ART = 112
// RoomScene's viewBox, and its hill line: the crest of the first saturated
// green hill (scenery.mid, 54 units above the bottom at x~128) -- the words
// end above it. The pale far ridge (scenery.far) may sit behind them, as on
// Speak and Write, where colors.text keeps >= 10:1.
const SCENE_W = 400
const SCENE_H = 200
const HILL_LINE = 54

const styles = StyleSheet.create({
  band: {
    overflow: 'hidden', paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomLeftRadius: shape.sheet, borderBottomRightRadius: shape.sheet,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  mainRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm + spacing.xs },
  // Title and subtitle start in the sky; lower lines (a progress pill, a
  // wrapped subtitle at large text) can reach the hills, where ui.text still
  // clears AA (home.tsx measured colors.text >= 5.62:1 on every hill band)
  // and the progress row carries its own white pill.
  textCol: { flex: 1, minWidth: 0, gap: 2, alignSelf: 'center', paddingBottom: spacing.sm },
  textColTall: { alignSelf: 'flex-start', paddingTop: spacing.xs, gap: spacing.xs },
  hostStand: { paddingBottom: spacing.xs },
  discStand: { paddingBottom: DISC_TRIM },
  words: { gap: 2 },
  wordsTall: { gap: spacing.xs },
  pinned: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // The speech layout (RoomBand `speech`).
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  speechRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.ms, marginTop: spacing.sm },
  // Top-aligned so the tail meets the host's head; grows with its words.
  bubble: {
    flex: 1, minWidth: 0, alignSelf: 'flex-start', marginTop: spacing.xs, gap: spacing.xxs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs,
    borderRadius: shape.bubble, borderWidth: 2, backgroundColor: ui.surface,
  },
  // A turned square on the bubble's END edge, its top+end corner facing the
  // host: clockwise under LTR, counter-clockwise under RTL (where `end` is
  // the left edge) -- QuizCard's HostPrompt tail, mirrored to the end.
  bubbleTail: {
    position: 'absolute', end: -7, top: spacing.md + spacing.xs, width: 12, height: 12,
    backgroundColor: ui.surface, borderTopWidth: 2, borderEndWidth: 2,
    transform: [{ rotate: I18nManager.isRTL ? '-45deg' : '45deg' }],
  },
  bubbleTitle: { fontFamily: fonts.display, fontSize: textSize.body, textAlign: textStart },
  bubbleLine: { fontFamily: fonts.medium, fontSize: textSize.small, color: ui.text, textAlign: textStart },
  title: { fontFamily: fonts.display, fontSize: textSize.h2, color: ui.textStrong, textAlign: textStart },
  subtitle: { fontFamily: fonts.medium, fontSize: textSize.small, color: ui.text, textAlign: textStart },
  // ScreenHeader's child back disc, with the line icon instead of «→».
  backHit: { minWidth: ui.hit, minHeight: ui.hit, flexShrink: 0, alignSelf: 'center' },
  backDisc: {
    width: ui.hit, height: ui.hit, borderRadius: shape.disc, backgroundColor: ui.surface,
    borderWidth: 2, borderColor: ui.divider, alignItems: 'center', justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  progress: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs, paddingVertical: spacing.xs + 2,
    borderRadius: shape.chip, backgroundColor: ui.surface, borderWidth: 2, borderColor: ui.divider,
  },
  track: { flex: 1 },
  progressMeta: { fontFamily: fonts.bold, fontSize: textSize.caption },
  doneCard: { width: '100%', maxWidth: 360 },
  doneFace: { alignItems: 'stretch' },
  doneStage: { height: DONE_ART + spacing.lg, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  doneText: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.md },
  doneTitle: { fontFamily: fonts.display, fontSize: textSize.h2, textAlign: 'center' },
  doneBody: { fontFamily: fonts.regular, fontSize: textSize.small, color: ui.text, textAlign: 'center' },
  scorePill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 36,
    paddingHorizontal: spacing.md, borderRadius: shape.chip, borderWidth: 2, backgroundColor: ui.surface,
  },
  scoreText: { fontFamily: fonts.bold, fontSize: textSize.body },
})
