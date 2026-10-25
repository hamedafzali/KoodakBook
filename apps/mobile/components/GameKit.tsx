import type { ReactNode } from 'react'
import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg'
import { ClayCard, ClaySurface } from '@/components/Clay'
import { Icon, type IconName } from '@/components/Icon'
import { RewardStar as IllustratedStar } from '@/components/Illustrations'
import { colors, fonts, naturalLineHeight, radii, ramps, scenery, spacing, textSize, textStart, tones, ui, type Ramp } from '@/lib/theme'

/* ── GameKit: the shared look of the games and math rooms (2026-09-28) ─────
 *
 * (The hubs' host intro is RoomScene's RoomBand with `speech`, 2026-09-29.)
 * The two hubs and their six game screens each hand-built the same pieces
 * (a star count in a header, «مرحله ۲ از ۵» as plain text, a done screen of
 * a loose character + title + buttons on the page). They now share:
 *
 *   GameRoomCard  a hub card: soft clay in the room's ramp, a drawn vignette
 *                 of the game (GameArt), title, one line, a forward disc.
 *                 `hero` lays it out wide (art beside the words).
 *   StatChip      a white pill with an Icon and a number (stars, moves, pairs).
 *   RoundTrack    «مرحله ۲ از ۵» plus a segmented track.
 *   ResultCard    the finish: a soft clay card, the host over a sunburst,
 *                 the title, earned stars and the actions.
 *
 * Every colour is a theme token (ramps / tones / scenery / ui); the art uses
 * tones' fills because a vignette wants several colours (theme.ts `tones`).
 * All art is decorative and hidden from screen readers; the control around
 * it carries the words. Physical coordinates inside the SVGs are fine: none
 * of these drawings has a reading direction.
 */

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const

/* ── GameRoomCard ───────────────────────────────────────────────────────── */

export function GameRoomCard({ ramp, title, sub, tag, art, hero = false, onPress, accessibilityLabel, style }: {
  ramp: Ramp
  title: string
  sub: string
  /** A short fact in a pill (e.g. «۳ تا ۵ سال»). Read in the card's label. */
  tag?: string
  art: ReactNode
  /** Wide layout: art beside the words (the hub's first card). */
  hero?: boolean
  onPress: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  const { width, fontScale } = useWindowDimensions()
  // Side by side at every phone width (at 320pt the art takes 44%, leaving
  // ~135pt of words); at large text sizes the hero stacks like the grid
  // cards instead, so the title and line keep their width.
  const wide = hero && fontScale <= 1.3
  const narrow = width < 360
  const label = accessibilityLabel ?? [title, sub, tag].filter(Boolean).join('، ')
  return (
    <ClayCard
      ramp={ramp}
      tone="soft"
      radius={radii.lg}
      onPress={onPress}
      accessibilityLabel={label}
      style={[hero ? styles.heroSlot : styles.gridSlot, style]}
      surfaceStyle={styles.fill}
      faceStyle={[styles.roomFace, wide && styles.roomFaceWide]}
    >
      <View style={[styles.artPanel, wide ? [styles.artPanelWide, narrow && styles.artPanelWideNarrow] : hero ? styles.artPanelHero : styles.artPanelGrid]} {...HIDDEN}>
        {art}
      </View>
      <View style={[styles.roomText, wide && styles.roomTextWide]}>
        {tag ? (
          <View style={styles.tagRow} {...HIDDEN}>
            <View style={[styles.tag, { backgroundColor: ramp.bright }]}>
              <Text style={[styles.tagText, { color: ramp.ink }]}>{tag}</Text>
            </View>
          </View>
        ) : null}
        <Text style={[styles.roomTitle, { color: ramp.ink }]}>{title}</Text>
        <Text style={styles.roomSub}>{sub}</Text>
        <View style={styles.goRow}>
          <View style={[styles.goDisc, { backgroundColor: ramp.bright }]}>
            <Icon name="chevron" color={ramp.ink} size={20} strokeWidth={3} />
          </View>
        </View>
      </View>
    </ClayCard>
  )
}

/* ── StatChip / StarChip ────────────────────────────────────────────────── */

/** A white pill: an Icon (or the app's reward star, Illustrations.tsx) and a
 *  value. One stop for a screen reader, with `accessibilityLabel` in words.
 *  `hidden` keeps the chip's room but shows and says nothing: a header's star
 *  count at zero (a «۰ ستاره» chip read as a score of nothing), without the
 *  title re-wrapping when the first star arrives. */
export function StatChip({ ramp, icon, value, accessibilityLabel, hidden = false }: {
  ramp: Ramp
  icon: IconName | 'rewardStar'
  value: string
  accessibilityLabel: string
  hidden?: boolean
}) {
  return (
    <View
      accessible={!hidden}
      accessibilityLabel={hidden ? undefined : accessibilityLabel}
      {...(hidden ? HIDDEN : null)}
      style={[styles.chip, { borderColor: ramp.bright }, hidden && styles.chipHidden]}
    >
      {icon === 'rewardStar' ? <IllustratedStar size={18} face={false} /> : <Icon name={icon} color={ramp.ink} size={18} strokeWidth={2.5} />}
      <Text style={[styles.chipText, { color: ramp.ink }]} maxFontSizeMultiplier={1.4}>{value}</Text>
    </View>
  )
}

/** A star in the result card's row: earned = the rewards room's filled gold
 *  star with a deep outline (two Icon passes -- the set draws one colour at a
 *  time), unearned = a faint outline. The header chips use Illustrations'
 *  RewardStar instead; it has no unearned state. */
export function RewardStar({ size, earned = true }: { size: number; earned?: boolean }) {
  return (
    <View style={{ width: size, height: size }} {...HIDDEN}>
      {earned ? <Icon name="star" color={ramps.rewards.bright} size={size} filled style={StyleSheet.absoluteFill} /> : null}
      <Icon name="star" color={earned ? ramps.rewards.deep : ui.faint} size={size} strokeWidth={1.6} style={StyleSheet.absoluteFill} />
    </View>
  )
}

/* ── RoundTrack ─────────────────────────────────────────────────────────── */

/** «مرحله ۲ از ۵» and a segmented track: done segments in the ramp's deep
 *  stop, the current one bright, the rest the neutral track. One stop for a
 *  screen reader (the words). */
export function RoundTrack({ ramp, label, index, total }: { ramp: Ramp; label: string; index: number; total: number }) {
  return (
    <View style={styles.track} accessible accessibilityLabel={label}>
      <Text style={styles.trackLabel}>{label}</Text>
      <View style={styles.trackBar} {...HIDDEN}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.trackSeg, { backgroundColor: i < index ? ramp.deep : i === index ? ramp.bright : ui.track }]}
          />
        ))}
      </View>
    </View>
  )
}

/* ── ResultCard ─────────────────────────────────────────────────────────── */

/**
 * A finished game: soft clay card, the host over a sunburst in the room's
 * bright stop, the result as a header, earned stars (when the game counts
 * them) and the actions. The caller mounts CelebrationOverlay beside it (a
 * win only) and announces the result; the stars are decorative, `sub` says
 * the count in words.
 */
export function ResultCard({ ramp, art, title, sub, stars, total, children }: {
  ramp: Ramp
  art: ReactNode
  title: string
  sub?: string
  stars?: number
  total?: number
  children?: ReactNode
}) {
  return (
    <ClaySurface ramp={ramp} tone="soft" radius={radii.xl} style={styles.resultCard} faceStyle={styles.resultFace}>
      <View style={styles.resultArt} {...HIDDEN}>
        <Svg width={RESULT_BURST} height={RESULT_BURST} viewBox="-50 -50 100 100" style={StyleSheet.absoluteFill}>
          <G opacity={0.55}>
            {Array.from({ length: 12 }, (_, i) => (
              <Path key={i} d="M0 0 L-6 -50 L6 -50 Z" fill={ramp.bright} transform={`rotate(${i * 30})`} />
            ))}
          </G>
          <Circle cx="0" cy="0" r="30" fill={colors.card} opacity={0.9} />
        </Svg>
        {art}
      </View>
      <Text style={styles.resultTitle} accessibilityRole="header">{title}</Text>
      {total ? (
        <View style={styles.starRow} {...HIDDEN}>
          {Array.from({ length: total }, (_, i) => <RewardStar key={i} size={total > 6 ? 22 : 28} earned={i < (stars ?? 0)} />)}
        </View>
      ) : null}
      {sub ? <Text style={styles.resultSub}>{sub}</Text> : null}
      <View style={styles.resultActions}>{children}</View>
    </ClaySurface>
  )
}
const RESULT_BURST = 176
export const RESULT_ART = 128

/* ── Board sizing ───────────────────────────────────────────────────────── */

/** The مارپله board's area for the first frame, before onLayout has measured
 *  it: the screen's width inside the 16pt gutters, and its height less the
 *  safe areas and the `chrome` (everything the screen stacks around the
 *  board). Portrait phones are width-bound, so this is usually the measured
 *  size exactly; a slightly generous `chrome` keeps any correction a grow,
 *  never an overflow. */
export function boardFirstFrame(
  win: { width: number; height: number },
  insets: { top: number; bottom: number },
  chrome: number,
): { w: number; h: number } {
  return { w: Math.max(0, win.width - 2 * spacing.md), h: Math.max(0, win.height - insets.top - insets.bottom - chrome) }
}

/* ── GameArt: one drawn vignette per game ───────────────────────────────── */

/** rotate(angle) about (cx, cy), spelled as translate/rotate/translate: the
 *  three-argument rotate() is not read the same by every SVG renderer. */
const rot = (a: number, cx: number, cy: number) => `translate(${cx} ${cy}) rotate(${a}) translate(${-cx} ${-cy})`

const STAR_PATH = 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z'
const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5'

function Apple({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <G>
      <Path d={`M${x} ${y - r * 0.9} q ${r * 0.1} ${-r * 0.5} ${r * 0.4} ${-r * 0.7}`} stroke={tones.amber.edge} strokeWidth={r * 0.18} strokeLinecap="round" fill="none" />
      <Ellipse cx={x + r * 0.45} cy={y - r * 1.2} rx={r * 0.42} ry={r * 0.2} fill={tones.lime.fill} transform={rot(-25, x + r * 0.45, y - r * 1.2)} />
      <Circle cx={x} cy={y} r={r} fill={tones.rose.fill} />
      <Circle cx={x} cy={y} r={r} fill="none" stroke={tones.rose.edge} strokeWidth={1.5} opacity={0.5} />
      <Ellipse cx={x - r * 0.38} cy={y - r * 0.35} rx={r * 0.22} ry={r * 0.32} fill={colors.card} opacity={0.6} />
    </G>
  )
}

function Ground({ ramp }: { ramp: Ramp }) {
  return <Ellipse cx="80" cy="92" rx="62" ry="6" fill={ramp.bright} opacity={0.3} />
}

function ArtSvg({ children }: { children: ReactNode }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet">
      {children}
    </Svg>
  )
}

/** بازی حافظه: a card face down, and two face-up cards that match. */
export function MemoryArt() {
  const r = ramps.games
  const faceCard = (cx: number, angle: number, check: boolean) => (
    <G transform={rot(angle, cx, 50)}>
      <Rect x={cx - 21} y={20} width={42} height={58} rx={9} fill={r.deep} />
      <Rect x={cx - 21} y={18} width={42} height={57} rx={9} fill={colors.card} stroke={r.bright} strokeWidth={2.5} />
      <Apple x={cx} y={44} r={10} />
      <Rect x={cx - 11} y={61} width={22} height={4} rx={2} fill={r.bright} />
      {check ? (
        <G>
          <Circle cx={cx + 17} cy={20} r={9} fill={ramps.lessons.bright} stroke={colors.card} strokeWidth={2} />
          <G transform={`translate(${cx + 11} 14) scale(0.5)`}>
            <Path d={CHECK_PATH} stroke={ramps.lessons.ink} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </G>
        </G>
      ) : null}
    </G>
  )
  return (
    <ArtSvg>
      <Ground ramp={r} />
      <G transform={rot(-10, 80, 50)}>
        <Rect x={59} y={22} width={42} height={58} rx={9} fill={r.deep} />
        <Rect x={59} y={20} width={42} height={57} rx={9} fill={r.bright} />
        <Rect x={64} y={25} width={32} height={47} rx={6} fill="none" stroke={colors.card} strokeWidth={1.5} opacity={0.7} />
        <G transform="translate(68 36.5)"><Path d={STAR_PATH} fill={colors.card} /></G>
      </G>
      {faceCard(36, -14, false)}
      {faceCard(124, 12, true)}
    </ArtSvg>
  )
}

/** مارپله: a little board with a ladder, a snake and a die. */
export function MarpeleArt() {
  const fills = [tones.rose.fill, tones.amber.fill, tones.emerald.fill, tones.sky.fill, tones.violet.fill, tones.orange.fill]
  const tiles = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      tiles.push(
        <Rect key={`${row}-${col}`} x={28 + col * 26} y={20 + row * 20} width={23} height={17} rx={4} fill={fills[(row * 4 + col) % fills.length]} opacity={0.75} />,
      )
    }
  }
  const wood = tones.amber.edge
  return (
    <ArtSvg>
      <Ground ramp={ramps.games} />
      <Rect x={22} y={17} width={116} height={70} rx={12} fill={tones.orange.edge} />
      <Rect x={22} y={14} width={116} height={68} rx={12} fill={tones.amber.fill} />
      <Rect x={25} y={17} width={110} height={62} rx={9} fill={colors.card} opacity={0.55} />
      {tiles}
      {/* ladder */}
      <Line x1={42} y1={74} x2={62} y2={24} stroke={wood} strokeWidth={3.5} strokeLinecap="round" />
      <Line x1={52} y1={78} x2={72} y2={28} stroke={wood} strokeWidth={3.5} strokeLinecap="round" />
      {[0.2, 0.4, 0.6, 0.8].map((t) => (
        <Line key={t} x1={42 + 20 * t} y1={74 - 50 * t} x2={52 + 20 * t} y2={78 - 50 * t} stroke={wood} strokeWidth={2.5} strokeLinecap="round" />
      ))}
      {/* snake */}
      <Path d="M112 28 C 92 36 124 50 104 60 C 92 66 100 74 92 78" stroke={tones.emerald.edge} strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path d="M112 28 C 92 36 124 50 104 60 C 92 66 100 74 92 78" stroke={tones.emerald.fill} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Circle cx={113} cy={27} r={6.5} fill={tones.emerald.edge} />
      <Circle cx={111} cy={25.5} r={1.6} fill={colors.card} />
      <Circle cx={115.5} cy={25.5} r={1.6} fill={colors.card} />
      {/* die */}
      <G transform={rot(14, 136, 74)}>
        <Rect x={122} y={62} width={28} height={28} rx={7} fill={ramps.games.bright} />
        <Rect x={122} y={60} width={28} height={27} rx={7} fill={colors.card} stroke={ramps.games.bright} strokeWidth={2} />
        <Circle cx={129} cy={67} r={2.6} fill={ramps.games.deep} />
        <Circle cx={136} cy={73.5} r={2.6} fill={ramps.games.deep} />
        <Circle cx={143} cy={80} r={2.6} fill={ramps.games.deep} />
      </G>
    </ArtSvg>
  )
}

function Kid({ x, y, fill }: { x: number; y: number; fill: string }) {
  const r = ramps.games
  return (
    <G>
      <Circle cx={x} cy={y} r={15} fill={colors.card} stroke={r.bright} strokeWidth={3} />
      <Path d={`M${x - 10} ${y - 5} q 10 -12 20 0`} fill={fill} />
      <Circle cx={x - 4.5} cy={y + 1} r={1.8} fill={r.ink} />
      <Circle cx={x + 4.5} cy={y + 1} r={1.8} fill={r.ink} />
      <Path d={`M${x - 4.5} ${y + 6} q 4.5 4 9 0`} stroke={r.ink} strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </G>
  )
}

/** مارپله آنلاین: two kids on either side of the globe, linked. */
export function OnlineArt() {
  const s = tones.sky
  return (
    <ArtSvg>
      <Ground ramp={ramps.games} />
      <Path d="M36 40 C 48 18 64 16 72 22" stroke={ramps.games.deep} strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" fill="none" />
      <Path d="M124 62 C 116 82 100 86 90 80" stroke={ramps.games.deep} strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" fill="none" />
      <Circle cx={80} cy={52} r={29} fill={s.edge} />
      <Circle cx={80} cy={50} r={29} fill={s.fill} />
      <Path d="M62 38 q 8 -6 14 0 q 4 6 -2 10 q -6 2 -8 8 q -6 0 -6 -8 z" fill={tones.emerald.fill} />
      <Path d="M88 56 q 8 -4 12 2 q 0 8 -8 10 q -6 -4 -4 -12 z" fill={tones.emerald.fill} />
      <Ellipse cx={80} cy={50} rx={12} ry={29} fill="none" stroke={colors.card} strokeWidth={1.5} opacity={0.7} />
      <Line x1={51} y1={50} x2={109} y2={50} stroke={colors.card} strokeWidth={1.5} opacity={0.7} />
      <Kid x={28} y={48} fill={tones.amber.edge} />
      <Kid x={132} y={54} fill={tones.orange.edge} />
      <G transform="translate(108 10) scale(0.7)"><Path d={STAR_PATH} fill={ramps.rewards.bright} stroke={ramps.rewards.deep} strokeWidth={1.5} strokeLinejoin="round" /></G>
    </ArtSvg>
  )
}

/** شمارش: three apples, each with its count in dots above it. */
export function CountingArt() {
  const m = ramps.math
  const dots = (cx: number, n: number) => (
    <G>
      <Rect x={cx - 4 - n * 3.5} y={12} width={8 + n * 7} height={14} rx={7} fill={colors.card} stroke={m.bright} strokeWidth={2} />
      {Array.from({ length: n }, (_, i) => <Circle key={i} cx={cx - (n - 1) * 3.5 + i * 7} cy={19} r={2.4} fill={m.deep} />)}
    </G>
  )
  return (
    <ArtSvg>
      <Ground ramp={m} />
      <Path d="M28 70 q 52 30 104 0 z" fill={tones.amber.fill} />
      <Path d="M28 70 q 52 30 104 0" stroke={tones.amber.edge} strokeWidth={2.5} fill="none" />
      <Apple x={50} y={58} r={14} />
      <Apple x={80} y={54} r={15} />
      <Apple x={110} y={58} r={14} />
      {dots(50, 1)}
      {dots(80, 2)}
      {dots(110, 3)}
    </ArtSvg>
  )
}

/** رقم‌های فارسی: ۷ = 7 on two tiles. Words drawn as Text (a vignette,
 *  hidden from screen readers and fixed in size like the rest of the art). */
export function DigitsArt() {
  const m = ramps.math
  return (
    <View style={styles.digitsArt}>
      <View style={[styles.digitTile, { backgroundColor: m.bright, borderColor: m.deep }]}>
        <Text style={[styles.digitText, { color: m.ink }]} allowFontScaling={false}>۷</Text>
      </View>
      <Text style={[styles.digitEq, { color: m.deep }]} allowFontScaling={false}>=</Text>
      <View style={[styles.digitTile, { backgroundColor: colors.card, borderColor: m.bright }]}>
        <Text style={[styles.digitText, { color: m.ink, writingDirection: 'ltr' }]} allowFontScaling={false}>7</Text>
      </View>
    </View>
  )
}

/** بازار: a striped stall with fruit on the counter and a stack of coins. */
export function BazaarArt() {
  const stripes = []
  for (let i = 0; i < 6; i++) {
    const x = 28 + i * 17
    stripes.push(<Path key={i} d={`M${x} 18 h17 v14 a8.5 8.5 0 0 1 -17 0 z`} fill={i % 2 ? colors.card : tones.rose.fill} />)
  }
  return (
    <ArtSvg>
      <Ground ramp={ramps.math} />
      <Rect x={32} y={30} width={5} height={52} rx={2} fill={tones.amber.edge} />
      <Rect x={123} y={30} width={5} height={52} rx={2} fill={tones.amber.edge} />
      <Rect x={24} y={12} width={112} height={8} rx={4} fill={tones.rose.edge} />
      {stripes}
      <Rect x={26} y={64} width={108} height={20} rx={5} fill={tones.amber.edge} />
      <Rect x={26} y={62} width={108} height={17} rx={5} fill={tones.amber.fill} />
      <Apple x={52} y={54} r={8} />
      <Path d="M66 56 q 12 8 22 -4" stroke={tones.amber.edge} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Path d="M66 56 q 12 8 22 -4" stroke={ramps.brand.bright} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M96 48 l 12 12 l -3 3 z" fill={tones.orange.fill} />
      <Path d="M96 48 l -3 -5 m 3 5 l 1 -6" stroke={tones.lime.edge} strokeWidth={2} strokeLinecap="round" />
      {[0, 1, 2].map((i) => (
        <G key={i}>
          <Ellipse cx={144} cy={86 - i * 6} rx={10} ry={4} fill={tones.amber.edge} />
          <Ellipse cx={144} cy={84 - i * 6} rx={10} ry={4} fill={ramps.brand.bright} />
        </G>
      ))}
    </ArtSvg>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // GameRoomCard
  heroSlot: { width: '100%' },
  // 40% + flexGrow: two per row at any width (ModuleCard's rule).
  gridSlot: { width: '40%', flexGrow: 1 },
  roomFace: { flex: 1, padding: spacing.sm + spacing.xs, gap: spacing.sm },
  roomFaceWide: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  artPanel: {
    borderRadius: radii.md, backgroundColor: colors.card, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', padding: spacing.xs,
  },
  artPanelGrid: { height: 116 },
  artPanelHero: { height: 132 },
  artPanelWide: { width: '48%', height: 148 },
  artPanelWideNarrow: { width: '44%', height: 128 },
  roomText: { flex: 1, gap: 2 },
  roomTextWide: { minWidth: 0 },
  tagRow: { flexDirection: 'row', marginBottom: 2 },
  tag: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  tagText: { fontFamily: fonts.bold, fontSize: textSize.micro },
  roomTitle: { fontFamily: fonts.display, fontSize: textSize.body, textAlign: textStart },
  roomSub: { fontFamily: fonts.medium, fontSize: textSize.caption, color: colors.text, textAlign: textStart },
  // A row mirrors under RTL: flex-end puts the forward disc at the reading
  // END (left in Persian), where Home's continue card has its arrow.
  goRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: spacing.xs },
  goDisc: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  // StatChip
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 36,
    paddingHorizontal: spacing.sm + spacing.xs, borderRadius: radii.pill, borderWidth: 2, backgroundColor: colors.card,
  },
  chipText: { fontFamily: fonts.bold, fontSize: textSize.small, flexShrink: 1 },
  chipHidden: { opacity: 0 },
  // RoundTrack
  track: { gap: spacing.xs + 2 },
  trackLabel: { fontFamily: fonts.bold, fontSize: textSize.caption, color: colors.text, textAlign: textStart },
  trackBar: { flexDirection: 'row', gap: spacing.xs },
  trackSeg: { flex: 1, height: 10, borderRadius: radii.pill },
  // ResultCard
  resultCard: { width: '100%', maxWidth: 380 },
  resultFace: { alignItems: 'center', gap: spacing.sm + spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.md },
  resultArt: { width: RESULT_BURST, height: RESULT_BURST, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontFamily: fonts.display, fontSize: textSize.h2, color: scenery.ink, textAlign: 'center' },
  resultSub: { fontFamily: fonts.medium, fontSize: textSize.small, color: colors.text, textAlign: 'center' },
  starRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  resultActions: { alignSelf: 'stretch', gap: spacing.sm + spacing.xs, marginTop: spacing.xs },
  // DigitsArt
  // Sized for the narrowest panel (a grid card at 320pt: ~110pt inside).
  digitsArt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, direction: 'ltr' },
  digitTile: {
    width: 42, height: 54, borderRadius: radii.sm, borderWidth: 3, borderBottomWidth: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  digitText: { fontFamily: fonts.display, fontSize: textSize.h2, lineHeight: naturalLineHeight(textSize.h2) },
  digitEq: { fontFamily: fonts.display, fontSize: textSize.cardTitle },
})
