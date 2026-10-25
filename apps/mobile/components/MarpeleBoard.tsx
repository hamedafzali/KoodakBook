import { useEffect, useRef } from 'react'
import { Animated, Easing, I18nManager, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polyline, Stop } from 'react-native-svg'
import { COLS, LADDERS, ROWS, SIZE, SNAKES, toPersianDigits } from '@koodakbook/shared'
import { clay, colors, fonts, radii, ramps } from '@/lib/theme'

/**
 * The مارپله board — a big winding path of vibrant tiles with a soft 2.5D tilt,
 * drawn snakes & ladders, squash-and-stretch hopping tokens (that climb ladders
 * and slither down snakes), and a pip die that tumbles. All animation is RN
 * Animated + react-native-svg; no heavy 3D.
 */

const TILE_COLORS = ['#fda4af', '#fcd34d', '#86efac', '#7dd3fc', '#c4b5fd', '#f9a8d4']
const BORDER = 4   // styles.board's borderWidth, drawn inside the board's box
const DEPTH = 8    // how far styles.depth shows below the board

/* RTL (2026-09-26): the board is one physical coordinate space. The SVG road,
 * snakes and ladders are drawn in physical x, but under the app's forced RTL
 * React Native swaps a View's `left` to the start (right) edge, so the tiles
 * came out mirrored against the drawings and the tokens (left + translateX)
 * were pushed off the board's far edge. The board now lays out LTR
 * (styles.stage `direction`) and the serpentine itself is mirrored here
 * instead, so square 1 still starts at the bottom-right under RTL and the
 * tiles, road, snakes, ladders and tokens all share one path.
 *
 * Text size (2026-09-27): every glyph on the board (tile numbers, tile and
 * token emoji) is sized from the cell, so it opts out of the system text size
 * (allowFontScaling={false}); scaled, the numbers overflowed their tiles at
 * the larger settings. The board is one image to a screen reader, and the
 * screen's label carries who is where. */
const MIRROR = I18nManager.isRTL

function centre(n: number, cell: number) {
  const r = Math.floor((n - 1) / COLS)
  const cRaw = (n - 1) % COLS
  const cLtr = r % 2 === 0 ? cRaw : COLS - 1 - cRaw
  const c = MIRROR ? COLS - 1 - cLtr : cLtr
  return { x: c * cell + cell / 2, y: (ROWS - 1 - r) * cell + cell / 2 }
}

const OFFSETS: [number, number][] = [[-0.17, -0.13], [0.17, -0.13], [-0.17, 0.15], [0.17, 0.15]]

/* ── Ladder: chunky wooden rails + rungs ─────────────────────────────── */
function Ladder({ from, to, cell }: { from: number; to: number; cell: number }) {
  const a = centre(from, cell)
  const b = centre(to, cell)
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  const off = cell * 0.17
  const r1a = { x: a.x + nx * off, y: a.y + ny * off }, r1b = { x: b.x + nx * off, y: b.y + ny * off }
  const r2a = { x: a.x - nx * off, y: a.y - ny * off }, r2b = { x: b.x - nx * off, y: b.y - ny * off }
  const rungs = Math.max(3, Math.round(len / (cell * 0.55)))
  return (
    <G>
      <Line x1={r1a.x} y1={r1a.y} x2={r1b.x} y2={r1b.y} stroke="#92400e" strokeWidth={6} strokeLinecap="round" />
      <Line x1={r2a.x} y1={r2a.y} x2={r2b.x} y2={r2b.y} stroke="#92400e" strokeWidth={6} strokeLinecap="round" />
      <Line x1={r1a.x} y1={r1a.y} x2={r1b.x} y2={r1b.y} stroke="#d97706" strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={r2a.x} y1={r2a.y} x2={r2b.x} y2={r2b.y} stroke="#d97706" strokeWidth={2.5} strokeLinecap="round" />
      {Array.from({ length: rungs - 1 }, (_, i) => {
        const t = (i + 1) / rungs
        return (
          <Line key={i}
            x1={r1a.x + (r1b.x - r1a.x) * t} y1={r1a.y + (r1b.y - r1a.y) * t}
            x2={r2a.x + (r2b.x - r2a.x) * t} y2={r2a.y + (r2b.y - r2a.y) * t}
            stroke="#b45309" strokeWidth={4} strokeLinecap="round" />
        )
      })}
    </G>
  )
}

/* ── Snake: gradient body, patterned belly, head with eyes + tongue ──── */
function Snake({ head, tail, cell, id }: { head: number; tail: number; cell: number; id: string }) {
  const h = centre(head, cell)
  const t = centre(tail, cell)
  const dx = t.x - h.x, dy = t.y - h.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  const bend = cell * 0.8
  const c1 = { x: h.x + dx * 0.3 + nx * bend, y: h.y + dy * 0.3 + ny * bend }
  const c2 = { x: h.x + dx * 0.7 - nx * bend, y: h.y + dy * 0.7 - ny * bend }
  const d = `M ${h.x} ${h.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${t.x} ${t.y}`
  return (
    <G>
      <Path d={d} stroke="#065f46" strokeWidth={cell * 0.26} fill="none" strokeLinecap="round" opacity={0.35} />
      <Path d={d} stroke={`url(#${id})`} strokeWidth={cell * 0.2} fill="none" strokeLinecap="round" />
      <Path d={d} stroke="#bbf7d0" strokeWidth={cell * 0.05} fill="none" strokeLinecap="round" strokeDasharray={`${cell * 0.12} ${cell * 0.2}`} opacity={0.8} />
      {/* head */}
      <Circle cx={h.x} cy={h.y} r={cell * 0.2} fill="#16a34a" />
      <Circle cx={h.x} cy={h.y} r={cell * 0.2} fill="none" stroke="#065f46" strokeWidth={2} />
      <Circle cx={h.x - cell * 0.07} cy={h.y - cell * 0.05} r={cell * 0.045} fill="#fff" />
      <Circle cx={h.x + cell * 0.07} cy={h.y - cell * 0.05} r={cell * 0.045} fill="#fff" />
      <Circle cx={h.x - cell * 0.07} cy={h.y - cell * 0.05} r={cell * 0.022} fill="#111" />
      <Circle cx={h.x + cell * 0.07} cy={h.y - cell * 0.05} r={cell * 0.022} fill="#111" />
      <Path d={`M ${h.x} ${h.y + cell * 0.14} l 0 ${cell * 0.1} m ${-cell * 0.04} 0 l ${cell * 0.08} 0`} stroke="#ef4444" strokeWidth={2} strokeLinecap="round" fill="none" />
    </G>
  )
}

/* ── Token: hops between squares, squashes on landing, slides/climbs on
 *    long moves (ladders & snakes) ───────────────────────────────────── */
function Token({ emoji, square, index, cell }: { emoji: string; square: number; index: number; cell: number }) {
  const [ox, oy] = OFFSETS[index % OFFSETS.length]
  // Off the board (0) waits on square 1, on whichever side it is.
  const target = centre(Math.max(1, square), cell)
  const tx = target.x + ox * cell
  const ty = target.y + oy * cell

  const ax = useRef(new Animated.Value(tx)).current
  const ay = useRef(new Animated.Value(ty)).current
  const prog = useRef(new Animated.Value(0)).current   // 0→1 during a move (arc + squash)
  const prev = useRef({ x: tx, y: ty })

  useEffect(() => {
    const from = prev.current
    const dist = Math.hypot(tx - from.x, ty - from.y)
    const long = dist > cell * 1.3            // a ladder climb or snake slide
    const dur = long ? 620 : 200
    prog.setValue(0)
    const move = Animated.parallel([
      Animated.timing(ax, { toValue: tx, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(ay, { toValue: ty, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(prog, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])
    move.start()
    prev.current = { x: tx, y: ty }
    // A hop still running when the next one starts (or the board unmounts)
    // is stopped; the next one continues from wherever the token is.
    return () => move.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx, ty])

  const size = cell * 0.66
  // arc up during the move, squash at the ends
  const arc = prog.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -cell * 0.3, 0] })
  const scaleY = prog.interpolate({ inputRange: [0, 0.2, 0.5, 0.85, 1], outputRange: [1, 0.82, 1.12, 0.86, 1] })
  const scaleX = prog.interpolate({ inputRange: [0, 0.2, 0.5, 0.85, 1], outputRange: [1, 1.18, 0.9, 1.16, 1] })
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: size, height: size, left: -size / 2, top: -size / 2,
        alignItems: 'center', justifyContent: 'center',
        transform: [{ translateX: ax }, { translateY: Animated.add(ay, arc) }, { scaleX }, { scaleY }],
      }}
    >
      <View style={[styles.tokenDisc, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.62 }} allowFontScaling={false}>{emoji}</Text>
      </View>
    </Animated.View>
  )
}

export default function MarpeleBoard({ positions, emojis, maxWidth, maxHeight, accessibilityLabel = 'صفحهٔ مارپله' }: {
  positions: number[]
  emojis: string[]
  maxWidth: number
  maxHeight: number
  /** The board is one image to a screen reader (30 numbered tiles read one
   *  by one was noise); the screen passes who is on which square. */
  accessibilityLabel?: string
}) {
  // Fill the available area: size cells to the smaller of the width/height fit.
  // The border is inside the board's box, so it is added around the cells
  // (it used to eat 8pt of them, clipping the last column and the bottom row).
  const cell = Math.max(1, Math.floor(Math.min((maxWidth - 2 * BORDER) / COLS, (maxHeight - 2 * BORDER - DEPTH) / ROWS)))
  const boardW = cell * COLS
  const boardH = cell * ROWS
  const outerW = boardW + 2 * BORDER
  const outerH = boardH + 2 * BORDER

  const tiles = Array.from({ length: SIZE }, (_, i) => ({ n: i + 1, ...centre(i + 1, cell) }))
  const roadPts = tiles.map((t) => `${t.x},${t.y}`).join(' ')

  return (
    <View style={styles.stage} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.depth, { width: outerW, height: outerH }]} />
      <View style={[styles.board, { width: outerW, height: outerH }]}>
        {/* winding road behind the tiles */}
        <Svg width={boardW} height={boardH} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Polyline points={roadPts} fill="none" stroke="#e7c9a0" strokeWidth={cell * 0.5} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points={roadPts} fill="none" stroke="#f5e6cc" strokeWidth={cell * 0.3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`2 ${cell * 0.35}`} />
        </Svg>

        {/* tiles */}
        {tiles.map((t) => {
          const ladder = t.n in LADDERS
          const snake = t.n in SNAKES
          const start = t.n === 1
          const finish = t.n === SIZE
          const bg = finish ? '#fde047' : start ? '#fdba74' : ladder ? '#bbf7d0' : snake ? '#fecaca' : TILE_COLORS[t.n % TILE_COLORS.length]
          return (
            <View key={t.n} style={[styles.tile, { width: cell * 0.8, height: cell * 0.8, left: t.x - cell * 0.4, top: t.y - cell * 0.4, backgroundColor: bg }]}>
              <View style={styles.gloss} />
              <Text style={[styles.num, { fontSize: cell * 0.15 }]} allowFontScaling={false}>{toPersianDigits(t.n)}</Text>
              {start && <Text style={{ fontSize: cell * 0.34 }} allowFontScaling={false}>🏠</Text>}
              {finish && <Text style={{ fontSize: cell * 0.34 }} allowFontScaling={false}>🏆</Text>}
              {ladder && !start && !finish && <Text style={{ fontSize: cell * 0.28 }} allowFontScaling={false}>🪜</Text>}
              {snake && !start && !finish && <Text style={{ fontSize: cell * 0.28 }} allowFontScaling={false}>🐍</Text>}
            </View>
          )
        })}

        {/* snakes & ladders above the tiles */}
        <Svg width={boardW} height={boardH} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            {Object.keys(SNAKES).map((h) => (
              <LinearGradient key={h} id={`sn${h}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#4ade80" />
                <Stop offset="1" stopColor="#15803d" />
              </LinearGradient>
            ))}
          </Defs>
          {Object.entries(LADDERS).map(([f, to]) => <Ladder key={`l${f}`} from={Number(f)} to={to} cell={cell} />)}
          {Object.entries(SNAKES).map(([h, to]) => <Snake key={`s${h}`} head={Number(h)} tail={to} cell={cell} id={`sn${h}`} />)}
        </Svg>

        {/* tokens on top */}
        {positions.map((sq, i) => <Token key={i} emoji={emojis[i]} square={sq} index={i} cell={cell} />)}
      </View>
    </View>
  )
}

/* ── Pip die that tumbles while rolling ──────────────────────────────── */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
}

export function Dice({ value, rolling }: { value: number | null; rolling: boolean }) {
  const spin = useRef(new Animated.Value(0)).current
  const pop = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (rolling) {
      spin.setValue(0)
      const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 240, easing: Easing.linear, useNativeDriver: true }))
      loop.start()
      return () => loop.stop()
    }
    // Upright again: stopping the loop left the die at whatever angle the
    // spin had reached, so the result showed tilted (e.g. 130°).
    spin.stopAnimation()
    spin.setValue(0)
    const land = Animated.sequence([
      Animated.timing(pop, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ])
    land.start()
    return () => land.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const face = value ?? 1
  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={rolling ? 'تاس در حال چرخیدن' : value ? `تاس: ${toPersianDigits(value)}` : 'تاس'}
      style={[styles.die, { transform: [{ perspective: 500 }, { rotate }, { scale: pop }] }]}
    >
      <View style={styles.pipGrid}>
        {[0, 1, 2].map((r) => (
          <View key={r} style={styles.pipRow}>
            {[0, 1, 2].map((c) => {
              const on = !rolling && PIPS[face].some(([pr, pc]) => pr === r && pc === c)
              return <View key={c} style={styles.pipSlot}>{on ? <View style={styles.pip} /> : null}</View>
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Physical coordinates for everything inside (see MIRROR above).
  stage: { alignItems: 'center', justifyContent: 'center', direction: 'ltr' },
  depth: { position: 'absolute', backgroundColor: '#b98a5e', borderRadius: 22, top: DEPTH },
  board: {
    backgroundColor: '#d9b892', borderRadius: 22, overflow: 'hidden',
    borderWidth: BORDER, borderColor: '#b98a5e',
  },
  tile: {
    position: 'absolute', borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%', backgroundColor: 'rgba(255,255,255,0.35)' },
  num: { position: 'absolute', top: 3, right: 5, fontFamily: fonts.bold, color: 'rgba(0,0,0,0.45)' },
  tokenDisc: {
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.card,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  die: {
    width: 66, height: 66, borderRadius: radii.sm, backgroundColor: colors.card, padding: 8,
    // Clay (2026-09-28): the games ramp's rim with a thicker bottom edge,
    // like the roll button beside it, instead of a cold grey hairline.
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    borderWidth: 2, borderBottomWidth: clay.edge, borderColor: ramps.games.bright,
  },
  pipGrid: { flex: 1, justifyContent: 'space-between' },
  pipRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pipSlot: { width: '30%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  // games deep (7.0:1 on the white face); the brand yellow pips were 1.7:1,
  // faint enough that a 3 and a 5 were hard to tell apart at a glance.
  pip: { width: '78%', height: '78%', borderRadius: radii.pill, backgroundColor: ramps.games.deep },
})
