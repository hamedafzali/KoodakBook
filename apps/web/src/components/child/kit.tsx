import { motion } from 'framer-motion'
import Link from 'next/link'

/* ── KoodakBook child design kit ────────────────────────────
 *
 * The system in one sentence: a warm cream canvas, white cards, ONE brand
 * accent (saffron amber), and a fixed semantic color per learning module —
 * used as soft tints and icon chips, never as full-bleed gradients.
 *
 * Rationale (docs/design-system.md):
 *  - Color = information. A module's color appears on its chip, its accent
 *    bar and its progress — so a child navigates by color long before they
 *    read. Six saturated gradients on one screen is decoration, not signal.
 *  - White cards on cream: highest text contrast (WCAG AA on slate-800),
 *    calmer for long sessions, and reads "premium" (Khan Kids, Duo ABC).
 *  - Touch: primary actions ≥56px, list items ≥48px (NN/g child research).
 *  - One radius scale (12/16/24), two shadow levels, one spring. */

export type ModuleKey =
  | 'lessons' | 'letters' | 'phonics' | 'stories' | 'review'
  | 'speak' | 'write' | 'math' | 'games' | 'rewards'

export const MODULE: Record<ModuleKey, {
  emoji: string
  chip: string      // icon chip: soft tint + strong icon color
  bar: string       // accent bar / active states
  soft: string      // large soft fill (tile image area)
}> = {
  lessons: { emoji: '📚', chip: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-400', soft: 'bg-emerald-50' },
  letters: { emoji: '✏️', chip: 'bg-sky-100 text-sky-600',         bar: 'bg-sky-400',     soft: 'bg-sky-50' },
  phonics: { emoji: '🎵', chip: 'bg-orange-100 text-orange-600',   bar: 'bg-orange-400',  soft: 'bg-orange-50' },
  stories: { emoji: '📖', chip: 'bg-teal-100 text-teal-600',       bar: 'bg-teal-400',    soft: 'bg-teal-50' },
  review:  { emoji: '🔄', chip: 'bg-violet-100 text-violet-600',   bar: 'bg-violet-400',  soft: 'bg-violet-50' },
  speak:   { emoji: '🎤', chip: 'bg-pink-100 text-pink-600',       bar: 'bg-pink-400',    soft: 'bg-pink-50' },
  write:   { emoji: '✍️', chip: 'bg-cyan-100 text-cyan-600',       bar: 'bg-cyan-400',    soft: 'bg-cyan-50' },
  math:    { emoji: '🔢', chip: 'bg-indigo-100 text-indigo-600',   bar: 'bg-indigo-400',  soft: 'bg-indigo-50' },
  games:   { emoji: '🃏', chip: 'bg-purple-100 text-purple-600',   bar: 'bg-purple-400',  soft: 'bg-purple-50' },
  rewards: { emoji: '🏆', chip: 'bg-amber-100 text-amber-600',     bar: 'bg-amber-400',   soft: 'bg-amber-50' },
}

/** Rounded-square icon chip — the module's color identity, everywhere. */
export function IconChip({ module: m, emoji, size = 'md' }: {
  module: ModuleKey; emoji?: string; size?: 'md' | 'lg' | 'xl'
}) {
  const s = size === 'xl' ? 'w-16 h-16 text-4xl rounded-2xl'
    : size === 'lg' ? 'w-14 h-14 text-3xl rounded-2xl'
    : 'w-12 h-12 text-2xl rounded-xl'
  return (
    <span className={`${s} ${MODULE[m].chip} flex items-center justify-center shrink-0`} aria-hidden="true">
      {emoji ?? MODULE[m].emoji}
    </span>
  )
}

/** Standard activity row card: white, chip, ≥64px target, quiet chevron. */
export function ModuleCard({ module: m, title, sub, href, emoji, big }: {
  module: ModuleKey; title: string; sub?: string; href: string; emoji?: string; big?: boolean
}) {
  return (
    <Link href={href} aria-label={sub ? `${title}: ${sub}` : title}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={`bg-white rounded-2xl shadow-card flex items-center gap-3 ${big ? 'p-5 min-h-[88px]' : 'p-4 min-h-[72px]'}`}
      >
        <IconChip module={m} emoji={emoji} size={big ? 'lg' : 'md'} />
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-slate-800 truncate ${big ? 'text-lg' : 'text-sm'}`}>{title}</p>
          {sub && <p className="text-xs text-slate-400 truncate mt-0.5">{sub}</p>}
        </div>
        <span className="text-slate-300 text-lg" aria-hidden="true">‹</span>
      </motion.div>
    </Link>
  )
}

/** Section heading with the module's accent tick — quiet, consistent. */
export function SectionTitle({ module: m, children }: { module?: ModuleKey; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {m && <span className={`w-1.5 h-5 rounded-full ${MODULE[m].bar}`} aria-hidden="true" />}
      <h2 className="font-bold text-slate-800 text-base">{children}</h2>
    </div>
  )
}
