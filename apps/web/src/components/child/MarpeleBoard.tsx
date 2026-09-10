'use client'
import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLS, LADDERS, ROWS, SIZE, SNAKES, boardRows, toPersianDigits } from '@koodakbook/shared'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { ClayButton } from '@/components/child/clay'
import QuizCard, { type QuizQuestion } from '@/components/child/QuizCard'

/* Web's مارپله board — CSS grid, not mobile's hand-drawn SVG snakes/ladders
 * (react-native-svg isn't available here and a from-scratch port wasn't worth
 * it for a first pass): each tile is a grid cell, ladder/snake tiles carry an
 * emoji badge instead of a drawn path, and tokens are absolutely positioned
 * emoji that animate between cells with a spring. Same board data
 * (packages/shared/marpele.ts) as mobile, so a game plays out identically. */

/* The board used to deal six pastels out by `n % 6`, so a tile's colour was a
 * function of its number and nothing else — six accents that looked like signal
 * and carried none, on top of a green/red pair that meant something. Colour on
 * this board now marks the four kinds of square a child needs to spot from
 * across the table: start, finish, ladder, snake. Everything else is the quiet
 * checker that makes the grid readable. */
function tileStyle(kind: 'start' | 'finish' | 'ladder' | 'snake' | 'plain', dark: boolean): React.CSSProperties {
  switch (kind) {
    case 'start':  return { background: 'var(--ramp-games-soft)', borderColor: 'var(--ramp-games-bright)' }
    case 'finish': return { background: 'var(--ramp-rewards-soft)', borderColor: 'var(--ramp-rewards-bright)' }
    /* Help and hazard are semantic, not the module hue — a child reads
       "climb" and "careful" here before they read "this is the game tab". */
    case 'ladder': return { background: '#D1FAE5', borderColor: '#6EE7B7' }
    case 'snake':  return { background: '#FFE4E6', borderColor: '#FDA4AF' }
    default:       return { background: dark ? '#FDF6EC' : '#FFFFFF', borderColor: 'rgb(255 255 255 / 0.7)' }
  }
}

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
        className="relative grid gap-1.5 rounded-3xl p-2.5 border-4"
        /* The board is the games module's one hero object, so the frame is the
           games ramp rather than the stray amber it used to borrow. */
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          background: 'var(--ramp-games-soft)',
          borderColor: 'var(--ramp-games-bright)',
        }}
      >
        {rows.map((row, r) =>
          row.map((n, c) => {
            const ladder = n in LADDERS
            const snake = n in SNAKES
            const start = n === 1
            const finish = n === SIZE
            const kind = finish ? 'finish' : start ? 'start' : ladder ? 'ladder' : snake ? 'snake' : 'plain'
            return (
              <div
                key={n}
                className="relative aspect-square rounded-xl border-2 shadow-sm flex items-center justify-center"
                style={{ gridRow: r + 1, gridColumn: c + 1, ...tileStyle(kind, (r + c) % 2 === 1) }}
              >
                {/* Was black/35 — about 2.3:1 on the tile. These numbers are how
                    a child checks whose token is ahead, so they have to read. */}
                <span className="absolute top-0.5 right-1 text-[10px] font-bold text-text-primary">{toPersianDigits(n)}</span>
                {start && <Icon name="home" size="md" />}
                {finish && <Icon name="rewards" size="md" />}
                {/* EMOJI-CONTENT: the ladder and the snake are the board's two
                    game mechanics, drawn as pieces — not affordances. They want
                    real board art, and an outline glyph would read as a control. */}
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
      className="w-16 h-16 rounded-2xl bg-white shadow-md border border-border p-2 grid grid-rows-3 gap-1 shrink-0"
      animate={rolling ? { rotate: [0, 360] } : { rotate: 0, scale: [1.2, 1] }}
      transition={rolling ? { duration: 0.24, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
    >
      {[0, 1, 2].map(r => (
        <div key={r} className="flex justify-between">
          {[0, 1, 2].map(c => {
            const on = !rolling && PIPS[face].some(([pr, pc]) => pr === r && pc === c)
            return (
              <div key={c} className="w-1/3 aspect-square flex items-center justify-center">
                {on && <div className="w-[78%] h-[78%] rounded-full" style={{ background: 'var(--ramp-games-deep)' }} />}
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
// EMOJI-CONTENT: confetti is celebration *particles*, thrown by the hundred.
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

/* ── Shared game vocabulary ───────────────────────────────────────────────────
 * The two مارپله screens (solo/pass-and-play and online) were built as ports of
 * two mobile screens and kept two copies of the same four objects — the turn
 * chip, the roll row, the challenge modal, the end screen — which is how one of
 * them ended up violet and the other sky for the identical state. One copy now,
 * on the games ramp, so a rule can only be expressed once. The board layout
 * itself stays bespoke: it is a board, not a list. */

/** Whose turn it is, and how far along they are. The active chip pulses and
 *  takes the module fill; the ring is the rewards ramp rather than the old
 *  yellow-300 (about 1.4:1 on white — an emphasis that wasn't visible). */
export function TurnChip({ emoji, name, square, active }: {
  emoji: string
  name: string
  square: number
  active: boolean
}) {
  return (
    <motion.div
      animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 1.2, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={active
        ? { background: 'var(--ramp-games-bright)', boxShadow: '0 0 0 3px var(--ramp-rewards-bright)' }
        : { background: '#FFFFFF' }}
    >
      <span className="text-lg" aria-hidden="true">{emoji}</span>
      <span className={`text-xs font-bold max-w-[70px] truncate ${active ? 'text-white' : 'text-text-primary'}`}>{name}</span>
      <span
        className={`text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[22px] text-center ${active ? 'bg-white/25 text-white' : 'bg-surface-subtle text-text-primary'}`}
        aria-label={`خانه ${toPersianDigits(square)}`}
      >
        {toPersianDigits(square)}
      </span>
    </motion.div>
  )
}

/** Dice + the roll button. The button is clay like every other primary in the
 *  child app — its "not your turn" state is the material's own disabled look,
 *  not a slate-300 fill that read as a different component. */
export function RollRow({ die, rolling, canRoll, label, onRoll }: {
  die: number | null
  rolling: boolean
  canRoll: boolean
  label: string
  onRoll: () => void
}) {
  return (
    <div className="flex items-center gap-3.5">
      <Dice value={die} rolling={rolling} />
      <ClayButton ramp="games" size="lg" disabled={!canRoll} onClick={onRoll} className="flex-1">
        {label}
      </ClayButton>
    </div>
  )
}

/** The ladder/snake question. Answer to climb, or to escape. */
export function ChallengeModal({ prompt, question, onResolve }: {
  prompt: string
  question: QuizQuestion
  onResolve: (correct: boolean) => void
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-5"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="dialog" aria-modal="true"
    >
      <motion.div
        className="bg-white rounded-3xl p-5 w-full max-w-sm flex flex-col gap-3"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
      >
        <p className="text-center font-bold text-text-primary persian-text">{prompt}</p>
        <QuizCard
          question={question}
          onCorrect={() => onResolve(true)}
          onIncorrect={() => onResolve(false)}
          onFlashcardNext={() => onResolve(true)}
        />
      </motion.div>
    </motion.div>
  )
}

/** End of the game. `won` is about the child holding the phone, not about who
 *  the winner is — losing to a friend still gets a real screen, just without
 *  the confetti. `token` is the winner's piece, shown when it isn't the child. */
export function GameOverScreen({ won, title, note, token, children }: {
  won: boolean
  title: string
  note?: string
  token?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 child-bg p-6 text-center">
      {won && <Confetti />}
      {won
        ? <span style={{ color: 'var(--ramp-rewards-bright)' }}><Icon name="rewards" size={96} strokeWidth={1.5} /></span>
        : token
          ? <span className="text-8xl leading-none" aria-hidden="true">{token}</span>
          : <span className="text-text-secondary"><Icon name="random" size={96} strokeWidth={1.5} /></span>}
      <h1 className="text-3xl font-bold text-text-primary">{title}</h1>
      {note && <p className="text-text-primary persian-text">{note}</p>}
      <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
        {children}
        {/* Was slate-400: 2.56:1, and the only way out of this screen. */}
        <Link href="/child/home" className="text-sm text-text-secondary hover:text-text-primary mt-1">برگشت به خانه</Link>
      </div>
    </div>
  )
}
