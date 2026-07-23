import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polyline, Stop } from 'react-native-svg'
import { toPersianDigits } from '@koodakbook/shared'
import { COLS, LADDERS, ROWS, SIZE, SNAKES } from '@/lib/marpele'
import { fonts } from '@/lib/theme'

/**
 * The مارپله board — a big winding path of vibrant tiles with a soft 2.5D tilt,
 * drawn snakes & ladders, squash-and-stretch hopping tokens (that climb ladders
 * and slither down snakes), and a pip die that tumbles. All animation is RN
 * Animated + react-native-svg; no heavy 3D.
 */

const TILE_COLORS = ['#fda4af', '#fcd34d', '#86efac', '#7dd3fc', '#c4b5fd', '#f9a8d4']

function centre(n: number, cell: number) {
  const r = Math.floor((n - 1) / COLS)
  const cRaw = (n - 1) % COLS
  const c = r % 2 === 0 ? cRaw : COLS - 1 - cRaw
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
  const target = square > 0 ? centre(square, cell) : { x: cell / 2, y: (ROWS - 0.5) * cell }
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
    Animated.parallel([
      Animated.timing(ax, { toValue: tx, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(ay, { toValue: ty, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(prog, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]).start()
    prev.current = { x: tx, y: ty }
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
        transform: [{ translateX: ax }, { translateY: Animated.add(ay, arc) }, { scaleX }, { scaleY }, { rotateX: '-18deg' }],
      }}
    >
      <View style={[styles.tokenDisc, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.62 }}>{emoji}</Text>
      </View>
    </Animated.View>
  )
}

export default function MarpeleBoard({ positions, emojis }: { positions: number[]; emojis: string[] }) {
  const { width } = useWindowDimensions()
  const boardW = Math.min(width - 20, 420)
  const cell = boardW / COLS
  const boardH = cell * ROWS

  const tiles = Array.from({ length: SIZE }, (_, i) => ({ n: i + 1, ...centre(i + 1, cell) }))
  const roadPts = tiles.map((t) => `${t.x},${t.y}`).join(' ')

  return (
    <View style={styles.stage}>
      <View style={[styles.depth, { width: boardW, height: boardH }]} />
      <View style={[styles.board, { width: boardW, height: boardH }]}>
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
              <Text style={[styles.num, { fontSize: cell * 0.15 }]}>{toPersianDigits(t.n)}</Text>
              {start && <Text style={{ fontSize: cell * 0.34 }}>🏠</Text>}
              {finish && <Text style={{ fontSize: cell * 0.34 }}>🏆</Text>}
              {ladder && !start && !finish && <Text style={{ fontSize: cell * 0.28 }}>🪜</Text>}
              {snake && !start && !finish && <Text style={{ fontSize: cell * 0.28 }}>🐍</Text>}
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
    spin.stopAnimation()
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start()
  }, [rolling])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const face = value ?? 1
  return (
    <Animated.View style={[styles.die, { transform: [{ perspective: 500 }, { rotate }, { scale: pop }] }]}>
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

/* ── Confetti burst for the win screen ───────────────────────────────── */
const CONFETTI = ['🎉', '⭐', '🎈', '✨', '🏅']
export function Confetti() {
  const { width } = useWindowDimensions()
  const pieces = useRef(
    Array.from({ length: 22 }, () => ({
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

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', transform: [{ perspective: 1000 }, { rotateX: '14deg' }] },
  depth: { position: 'absolute', backgroundColor: '#b98a5e', borderRadius: 22, top: 12 },
  board: {
    backgroundColor: '#d9b892', borderRadius: 22, overflow: 'hidden',
    borderWidth: 4, borderColor: '#b98a5e',
  },
  tile: {
    position: 'absolute', borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%', backgroundColor: 'rgba(255,255,255,0.35)' },
  num: { position: 'absolute', top: 3, right: 5, fontFamily: fonts.bold, color: 'rgba(0,0,0,0.45)' },
  tokenDisc: {
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  die: {
    width: 66, height: 66, borderRadius: 16, backgroundColor: '#fff', padding: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  pipGrid: { flex: 1, justifyContent: 'space-between' },
  pipRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pipSlot: { width: '30%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  pip: { width: '78%', height: '78%', borderRadius: 999, backgroundColor: '#7c3aed' },
})
