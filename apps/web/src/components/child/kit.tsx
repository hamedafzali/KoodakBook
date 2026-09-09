import { motion } from 'framer-motion'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/icons'

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
  icon: IconName    // Lucide glyph — never an emoji, see components/icons.tsx
  chip: string      // icon chip: soft tint + strong icon color
  bar: string       // accent bar / active states
  soft: string      // large soft fill (tile image area)
  solid: string     // chunky tile fill (saturated) — white text sits on this, see note below
  edge: string      // chunky tile 3D bottom edge (darker shade)
}> = {
  // `solid` was the -400 step until the 2026-09 contrast audit: white
  // title text on a -400 fill measures ~1.9–2.5:1 (WCAG needs ≥4.5:1 normal
  // text, ≥3:1 large/bold) across every module — the tile pattern used on
  // the home screen and everywhere ModuleCard renders. Moved to -700 (all
  // ≥5:1 on white); `edge` moved to -900 so the 3D bottom-border depth cue
  // stays visibly darker than the fill. `chip`/`bar`/`soft` are unaffected —
  // those never carry white text on top.
  lessons: { icon: 'lessons', chip: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-400', soft: 'bg-emerald-50', solid: 'bg-emerald-700', edge: 'border-emerald-900' },
  letters: { icon: 'letters', chip: 'bg-sky-100 text-sky-600',         bar: 'bg-sky-400',     soft: 'bg-sky-50',     solid: 'bg-sky-700',     edge: 'border-sky-900' },
  phonics: { icon: 'phonics', chip: 'bg-orange-100 text-orange-600',   bar: 'bg-orange-400',  soft: 'bg-orange-50',  solid: 'bg-orange-700',  edge: 'border-orange-900' },
  stories: { icon: 'stories', chip: 'bg-teal-100 text-teal-600',       bar: 'bg-teal-400',    soft: 'bg-teal-50',    solid: 'bg-teal-700',    edge: 'border-teal-900' },
  review:  { icon: 'review',  chip: 'bg-violet-100 text-violet-600',   bar: 'bg-violet-400',  soft: 'bg-violet-50',  solid: 'bg-violet-700',  edge: 'border-violet-900' },
  speak:   { icon: 'speak',   chip: 'bg-pink-100 text-pink-600',       bar: 'bg-pink-400',    soft: 'bg-pink-50',    solid: 'bg-pink-700',    edge: 'border-pink-900' },
  write:   { icon: 'write',   chip: 'bg-cyan-100 text-cyan-600',       bar: 'bg-cyan-400',    soft: 'bg-cyan-50',    solid: 'bg-cyan-700',    edge: 'border-cyan-900' },
  math:    { icon: 'math',    chip: 'bg-indigo-100 text-indigo-600',   bar: 'bg-indigo-400',  soft: 'bg-indigo-50',  solid: 'bg-indigo-700',  edge: 'border-indigo-900' },
  games:   { icon: 'games',   chip: 'bg-purple-100 text-purple-600',   bar: 'bg-purple-400',  soft: 'bg-purple-50',  solid: 'bg-purple-700',  edge: 'border-purple-900' },
  rewards: { icon: 'rewards', chip: 'bg-amber-100 text-amber-600',     bar: 'bg-amber-400',   soft: 'bg-amber-50',   solid: 'bg-amber-700',   edge: 'border-amber-900' },
}

/** Rounded-square icon chip — the module's color identity, everywhere.
 *  The glyph inherits the chip's text color, so one hue drives tint AND icon. */
export function IconChip({ module: m, icon, size = 'md' }: {
  module: ModuleKey; icon?: IconName; size?: 'md' | 'lg' | 'xl'
}) {
  const s = size === 'xl' ? 'w-16 h-16 rounded-2xl'
    : size === 'lg' ? 'w-14 h-14 rounded-2xl'
    : 'w-12 h-12 rounded-xl'
  const glyph = size === 'xl' ? 'xl' : size === 'lg' ? 'lg' : 'md'
  return (
    <span className={`${s} ${MODULE[m].chip} flex items-center justify-center shrink-0`}>
      <Icon name={icon ?? MODULE[m].icon} size={glyph} strokeWidth={2.2} />
    </span>
  )
}

/** Chunky activity tile — the tactile "press me" language of great kids'
 *  apps: saturated module color, thick darker bottom edge (3D), the tile
 *  physically sinks when pressed. Playful AND systematic: still exactly one
 *  hue per module, so color keeps carrying meaning. */
export function ModuleCard({ module: m, title, sub, href, icon, big }: {
  module: ModuleKey; title: string; sub?: string; href: string; icon?: IconName; big?: boolean
}) {
  const c = MODULE[m]
  return (
    <Link href={href} aria-label={sub ? `${title}: ${sub}` : title} className="block group">
      <motion.div
        whileTap={{ y: 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        className={`relative overflow-hidden ${c.solid} ${c.edge} border-b-[6px] group-active:border-b-2 rounded-2xl flex items-center gap-3 text-white ${big ? 'p-5 min-h-[92px]' : 'p-4 min-h-[76px]'}`}
      >
        {/* soft highlight blob = toy-like sheen */}
        <span className="absolute -top-6 -left-6 w-20 h-20 bg-white/15 rounded-full" aria-hidden="true" />
        <Icon name={icon ?? c.icon} size={big ? 'hero' : 'xl'} strokeWidth={2.2} className="drop-shadow-sm" />
        <div className="flex-1 min-w-0">
          <p className={`font-bold drop-shadow-sm ${big ? 'text-lg' : 'text-[15px]'}`}>{title}</p>
          {sub && <p className="text-xs text-white/85 truncate mt-0.5">{sub}</p>}
        </div>
      </motion.div>
    </Link>
  )
}

/** Primary CTA in the same chunky language (amber, the brand hue).
 *  Fill is amber-700, not amber-500: white text on amber-500 measured
 *  ~2.15:1 (2026-09 contrast audit) on the app's single most-pressed
 *  button — amber-700 clears WCAG AA (~5:1) for every size this renders at. */
export function ChunkyButton({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center gap-1.5 bg-amber-700 border-amber-900 border-b-[5px] active:border-b-2 active:translate-y-[3px] text-white font-bold rounded-2xl transition-all ${className}`}>
      {children}
    </span>
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
