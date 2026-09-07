'use client'
import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLS, LADDERS, ROWS, SIZE, SNAKES, boardRows, toPersianDigits } from '@koodakbook/shared'

/* Web's مارپله board — CSS grid, not mobile's hand-drawn SVG snakes/ladders
 * (react-native-svg isn't available here and a from-scratch port wasn't worth
 * it for a first pass): each tile is a grid cell, ladder/snake tiles carry an
 * emoji badge instead of a drawn path, and tokens are absolutely positioned
 * emoji that animate between cells with a spring. Same board data
 * (packages/shared/marpele.ts) as mobile, so a game plays out identically. */

const TILE_COLORS = ['bg-rose-200', 'bg-amber-200', 'bg-green-200', 'bg-sky-200', 'bg-violet-200', 'bg-pink-200']

function cellOf(square: number): { row: number; col: number } {
  const rows = boardRows()
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r].indexOf(square)
    if (c !== -1) return { row: r, col: c }
  }
  return { row: rows.length - 1, col: 0 }
}

export default function MarpeleBoard({ positions, emojis }: { positions: number[]; emojis: string[] }) {
  const rows = useMemo(() => boardRows(), [])

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className="relative grid gap-1.5 bg-amber-900/10 rounded-3xl p-2.5 border-4 border-amber-800/20"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
      >
        {rows.map((row, r) =>
          row.map((n, c) => {
            const ladder = n in LADDERS
            const snake = n in SNAKES
            const start = n === 1
            const finish = n === SIZE
            const bg = finish ? 'bg-yellow-300' : start ? 'bg-orange-300' : ladder ? 'bg-green-200' : snake ? 'bg-red-200' : TILE_COLORS[n % TILE_COLORS.length]
            return (
              <div
                key={n}
                className={`relative aspect-square rounded-xl ${bg} border-2 border-white/70 shadow-sm flex items-center justify-center`}
                style={{ gridRow: r + 1, gridColumn: c + 1 }}
              >
                <span className="absolute top-0.5 right-1 text-[10px] font-bold text-black/35">{toPersianDigits(n)}</span>
                {start && <span className="text-xl">🏠</span>}
                {finish && <span className="text-xl">🏆</span>}
                {ladder && !start && !finish && <span className="text-lg">🪜{toPersianDigits(LADDERS[n])}</span>}
                {snake && !start && !finish && <span className="text-lg">🐍</span>}
              </div>
            )
          })
        )}

        {/* Tokens — positioned as a percentage of the grid, animated on move */}
        {positions.map((sq, i) => {
          if (sq <= 0) return null
          const { row, col } = cellOf(sq)
          const OFFSETS = [[-8, -6], [8, -6], [-8, 8], [8, 8]] as const
          const [ox, oy] = OFFSETS[i % OFFSETS.length]
          return (
            <motion.div
              key={i}
              className="absolute z-10 w-8 h-8 -ml-4 -mt-4 rounded-full bg-white border-2 border-white shadow-md flex items-center justify-center text-lg pointer-events-none"
              animate={{
                left: `calc(${((col + 0.5) / COLS) * 100}% + ${ox}px)`,
                top: `calc(${((row + 0.5) / ROWS) * 100}% + ${oy}px)`,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              {emojis[i]}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Dice ─────────────────────────────────────────────────────────────── */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
}

export function Dice({ value, rolling }: { value: number | null; rolling: boolean }) {
  const face = value ?? 1
  return (
    <motion.div
      className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-200 p-2 grid grid-rows-3 gap-1 shrink-0"
      animate={rolling ? { rotate: [0, 360] } : { rotate: 0, scale: [1.2, 1] }}
      transition={rolling ? { duration: 0.24, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
    >
      {[0, 1, 2].map(r => (
        <div key={r} className="flex justify-between">
          {[0, 1, 2].map(c => {
            const on = !rolling && PIPS[face].some(([pr, pc]) => pr === r && pc === c)
            return (
              <div key={c} className="w-1/3 aspect-square flex items-center justify-center">
                {on && <div className="w-[78%] h-[78%] rounded-full bg-purple-600" />}
              </div>
            )
          })}
        </div>
      ))}
    </motion.div>
  )
}

/* ── Confetti burst for the win screen (emoji, no canvas — kept local so the
 * page doesn't pull in canvas-confetti just for this) ──────────────────── */
const CONFETTI = ['🎉', '⭐', '🎈', '✨', '🏅']
export function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 22 }, () => ({
    x: Math.random() * 100,
    emoji: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    delay: Math.random() * 0.6,
    size: 18 + Math.random() * 16,
  })), [])
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {pieces.map((p, i) => (
          <motion.span
            key={i}
            className="absolute"
            style={{ left: `${p.x}%`, top: -40, fontSize: p.size }}
            initial={{ y: 0, rotate: 0, opacity: 1 }}
            animate={{ y: '110vh', rotate: 540, opacity: [1, 1, 0] }}
            transition={{ duration: 2.2, delay: p.delay, ease: 'easeIn' }}
          >
            {p.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}
