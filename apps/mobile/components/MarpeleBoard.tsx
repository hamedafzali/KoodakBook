import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, G, Line, Path } from 'react-native-svg'
import { toPersianDigits } from '@koodakbook/shared'
import { COLS, LADDERS, ROWS, SIZE, SNAKES } from '@/lib/marpele'
import { colors, fonts } from '@/lib/theme'

/**
 * 2.5D مارپله board: absolutely-positioned tiles with a bevel + a board frame
 * for depth, real drawn snakes & ladders (SVG) connecting the squares, hopping
 * player tokens, and a gentle perspective tilt so it reads like a board on a
 * table. Geometry is computed so tokens and the snake/ladder art line up.
 */

// Pixel centre of square n on a grid of `cell`-sized squares, square 1 at
// bottom-left, snaking upward (boustrophedon).
function centre(n: number, cell: number) {
  const r = Math.floor((n - 1) / COLS)
  const cRaw = (n - 1) % COLS
  const c = r % 2 === 0 ? cRaw : COLS - 1 - cRaw
  return { x: c * cell + cell / 2, y: (ROWS - 1 - r) * cell + cell / 2 }
}

function tileTint(n: number): string {
  if (n in LADDERS) return '#dcfce7'
  if (n in SNAKES) return '#fee2e2'
  return (Math.floor((n - 1) / COLS) + ((n - 1) % COLS)) % 2 === 0 ? '#fffaf0' : '#fef3e2'
}

// Small per-player offsets so overlapping tokens don't fully hide each other.
const OFFSETS: [number, number][] = [[-0.16, -0.12], [0.16, -0.12], [-0.16, 0.14], [0.16, 0.14]]

function Ladder({ from, to, cell }: { from: number; to: number; cell: number }) {
  const a = centre(from, cell)
  const b = centre(to, cell)
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len          // perpendicular unit
  const off = cell * 0.16
  const r1a = { x: a.x + nx * off, y: a.y + ny * off }
  const r1b = { x: b.x + nx * off, y: b.y + ny * off }
  const r2a = { x: a.x - nx * off, y: a.y - ny * off }
  const r2b = { x: b.x - nx * off, y: b.y - ny * off }
  const rungs = Math.max(3, Math.round(len / (cell * 0.5)))
  return (
    <G>
      <Line x1={r1a.x} y1={r1a.y} x2={r1b.x} y2={r1b.y} stroke="#b45309" strokeWidth={4} strokeLinecap="round" />
      <Line x1={r2a.x} y1={r2a.y} x2={r2b.x} y2={r2b.y} stroke="#b45309" strokeWidth={4} strokeLinecap="round" />
      {Array.from({ length: rungs - 1 }, (_, i) => {
        const t = (i + 1) / rungs
        return (
          <Line key={i}
            x1={r1a.x + (r1b.x - r1a.x) * t} y1={r1a.y + (r1b.y - r1a.y) * t}
            x2={r2a.x + (r2b.x - r2a.x) * t} y2={r2a.y + (r2b.y - r2a.y) * t}
            stroke="#d97706" strokeWidth={3} strokeLinecap="round" />
        )
      })}
    </G>
  )
}

function Snake({ head, tail, cell }: { head: number; tail: number; cell: number }) {
  const h = centre(head, cell)
  const t = centre(tail, cell)
  const dx = t.x - h.x, dy = t.y - h.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  const bend = cell * 0.7
  const c1 = { x: h.x + dx * 0.3 + nx * bend, y: h.y + dy * 0.3 + ny * bend }
  const c2 = { x: h.x + dx * 0.7 - nx * bend, y: h.y + dy * 0.7 - ny * bend }
  const d = `M ${h.x} ${h.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${t.x} ${t.y}`
  return (
    <G>
      <Path d={d} stroke="#16a34a" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.55} />
      <Path d={d} stroke="#22c55e" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Circle cx={h.x} cy={h.y} r={cell * 0.16} fill="#16a34a" />
      <Circle cx={h.x - cell * 0.05} cy={h.y - cell * 0.04} r={cell * 0.03} fill="#fff" />
      <Circle cx={h.x + cell * 0.05} cy={h.y - cell * 0.04} r={cell * 0.03} fill="#fff" />
    </G>
  )
}

function Token({ emoji, square, index, cell }: { emoji: string; square: number; index: number; cell: number }) {
  const [ox, oy] = OFFSETS[index % OFFSETS.length]
  const target = square > 0 ? centre(square, cell) : { x: cell / 2, y: (ROWS - 0.5) * cell }
  const tx = target.x + ox * cell
  const ty = target.y + oy * cell
  const ax = useRef(new Animated.Value(tx)).current
  const ay = useRef(new Animated.Value(ty)).current
  const hop = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ax, { toValue: tx, duration: 160, useNativeDriver: true }),
      Animated.timing(ay, { toValue: ty, duration: 160, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]),
    ]).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx, ty])

  const size = cell * 0.62
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -cell * 0.32] })
  return (
    <Animated.View
      style={{
        position: 'absolute', width: size, height: size, left: -size / 2, top: -size / 2,
        alignItems: 'center', justifyContent: 'center',
        transform: [{ translateX: ax }, { translateY: Animated.add(ay, hopY) }, { rotateX: '-16deg' }],
      }}
    >
      <Text style={{ fontSize: size * 0.8, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 }}>{emoji}</Text>
    </Animated.View>
  )
}

/** A die that tumbles while rolling, then settles on its face. */
export function Dice({ value, rolling }: { value: number | null; rolling: boolean }) {
  const spin = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (rolling) {
      spin.setValue(0)
      const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 260, useNativeDriver: true }))
      loop.start()
      return () => loop.stop()
    }
    spin.stopAnimation()
    Animated.timing(spin, { toValue: 0, duration: 120, useNativeDriver: true }).start()
  }, [rolling])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  return (
    <Animated.View style={[styles.die, { transform: [{ rotate }, { perspective: 400 }] }]}>
      <Text style={styles.dieText}>{rolling ? '🎲' : value ? toPersianDigits(value) : '🎲'}</Text>
    </Animated.View>
  )
}

export default function MarpeleBoard({ positions, emojis }: { positions: number[]; emojis: string[] }) {
  const { width } = useWindowDimensions()
  const boardW = Math.min(width - 32, 340)
  const cell = boardW / COLS
  const boardH = cell * ROWS

  const tiles = Array.from({ length: SIZE }, (_, i) => {
    const n = i + 1
    const p = centre(n, cell)
    return { n, x: p.x, y: p.y }
  })

  return (
    <View style={styles.stage}>
      {/* depth shadow under the board */}
      <View style={[styles.depth, { width: boardW, height: boardH, borderRadius: 16 }]} />
      <View style={[styles.board, { width: boardW, height: boardH }]}>
        {tiles.map((t) => (
          <View
            key={t.n}
            style={[styles.tile, {
              width: cell - 4, height: cell - 4, left: t.x - cell / 2 + 2, top: t.y - cell / 2 + 2,
              backgroundColor: tileTint(t.n),
            }]}
          >
            <Text style={[styles.num, { fontSize: cell * 0.16 }]}>{toPersianDigits(t.n)}</Text>
          </View>
        ))}

        <Svg width={boardW} height={boardH} style={StyleSheet.absoluteFill} pointerEvents="none">
          {Object.entries(LADDERS).map(([f, to]) => <Ladder key={`l${f}`} from={Number(f)} to={to} cell={cell} />)}
          {Object.entries(SNAKES).map(([h, to]) => <Snake key={`s${h}`} head={Number(h)} tail={to} cell={cell} />)}
        </Svg>

        {positions.map((sq, i) => <Token key={i} emoji={emojis[i]} square={sq} index={i} cell={cell} />)}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // The tilt gives the 2.5D "board on a table" look; tokens counter-rotate to stand.
  stage: { alignItems: 'center', justifyContent: 'center', transform: [{ perspective: 900 }, { rotateX: '16deg' }] },
  depth: { position: 'absolute', backgroundColor: '#c2916b', top: 10 },
  board: {
    backgroundColor: '#e9d5b8', borderRadius: 16, padding: 0, overflow: 'hidden',
    borderWidth: 3, borderColor: '#c2916b',
  },
  tile: {
    position: 'absolute', borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 1.5, borderTopColor: 'rgba(255,255,255,0.7)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  num: { position: 'absolute', top: 3, right: 5, fontFamily: fonts.regular, color: colors.muted },
  die: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  dieText: { fontSize: 30, fontFamily: fonts.bold, color: colors.text },
})

