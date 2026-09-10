import { Icon, type IconName } from '@/components/icons'
import {
  ClayBar, ClayButton, ClayChip, ClayIconChip, ClayTile, clayVars, type Ramp,
} from '@/components/child/clay'

/* ── KoodakBook child design kit ────────────────────────────
 *
 * The system in one sentence: a warm cream canvas, joyful cards, a saffron
 * brand accent, and a fixed bright color per learning module — so a child
 * navigates by color long before they can read.
 *
 * This file owns the VOCABULARY: which hue and which glyph mean "stories".
 * `clay.tsx` owns the MATERIAL — how a pressable thing is built. The split
 * matters because the material is now shared and the vocabulary is not: the
 * parent app uses neither.
 *
 * Rationale (DESIGN_CHARTER.md):
 *  - Color = information AND delight. Each module owns one bright hue, shown
 *    large and saturated on its tiles — this is a children's app, the color
 *    is the product. A strong gradient per screen (hero / CTA) is welcome.
 *  - Contrast is met with DARK INK on the bright/soft fill, never white on a
 *    darkened one. Warm neutrals (cream, warm ink), not cold slate.
 *  - Touch: primary actions ≥56px, list items ≥48px (NN/g child research).
 *  - One radius scale (12/16/24), springy press feedback. */

/** Every module key is also a ramp name in globals.css — that is the point of
 *  the ramps, and the type below enforces it: adding a module without adding
 *  its ramp is a build error, not a screen that renders unstyled. */
export type ModuleKey =
  | 'lessons' | 'letters' | 'phonics' | 'stories' | 'review'
  | 'speak' | 'write' | 'math' | 'games' | 'rewards'

const _moduleKeysAreRamps: Record<ModuleKey, Ramp> = {
  lessons: 'lessons', letters: 'letters', phonics: 'phonics', stories: 'stories',
  review: 'review', speak: 'speak', write: 'write', math: 'math',
  games: 'games', rewards: 'rewards',
}
void _moduleKeysAreRamps

export const MODULE: Record<ModuleKey, {
  icon: IconName    // Lucide glyph — never an emoji, see components/icons.tsx
  chip: string      // icon chip: soft tint + strong icon color
  bar: string       // accent bar / active states
  soft: string      // large soft fill (tile image area) — dark ink sits on this
  solid: string     // chunky tile fill (bright) — dark ink sits on this
  edge: string      // chunky tile 3D bottom edge (deep) — white text sits on this
}> = {
  /* These point at the app's own 4-stop ramps (tools/design/ramps.py), which
   * keep each module's shipped Tailwind hue (-400 fill, -50 tint) and solve
   * the two dark support stops around it. DESIGN_CHARTER.md pairing:
   *   solid (bright) + ink text  >= 5.0:1     soft + ink text  >= 5.0:1
   *   deep carries white text and is the 3D edge — visibly darker than solid.
   * Dark ink on a joyful fill, never white on a darkened one. */
  lessons: { icon: 'lessons', chip: 'bg-lessons-soft text-lessons-ink', bar: 'bg-lessons-bright', soft: 'bg-lessons-soft', solid: 'bg-lessons-bright', edge: 'border-lessons-deep' },
  letters: { icon: 'letters', chip: 'bg-letters-soft text-letters-ink', bar: 'bg-letters-bright', soft: 'bg-letters-soft', solid: 'bg-letters-bright', edge: 'border-letters-deep' },
  phonics: { icon: 'phonics', chip: 'bg-phonics-soft text-phonics-ink', bar: 'bg-phonics-bright', soft: 'bg-phonics-soft', solid: 'bg-phonics-bright', edge: 'border-phonics-deep' },
  stories: { icon: 'stories', chip: 'bg-stories-soft text-stories-ink', bar: 'bg-stories-bright', soft: 'bg-stories-soft', solid: 'bg-stories-bright', edge: 'border-stories-deep' },
  review:  { icon: 'review',  chip: 'bg-review-soft text-review-ink',   bar: 'bg-review-bright',  soft: 'bg-review-soft',  solid: 'bg-review-bright',  edge: 'border-review-deep' },
  speak:   { icon: 'speak',   chip: 'bg-speak-soft text-speak-ink',     bar: 'bg-speak-bright',   soft: 'bg-speak-soft',   solid: 'bg-speak-bright',   edge: 'border-speak-deep' },
  write:   { icon: 'write',   chip: 'bg-write-soft text-write-ink',     bar: 'bg-write-bright',   soft: 'bg-write-soft',   solid: 'bg-write-bright',   edge: 'border-write-deep' },
  math:    { icon: 'math',    chip: 'bg-math-soft text-math-ink',       bar: 'bg-math-bright',    soft: 'bg-math-soft',    solid: 'bg-math-bright',    edge: 'border-math-deep' },
  games:   { icon: 'games',   chip: 'bg-games-soft text-games-ink',     bar: 'bg-games-bright',   soft: 'bg-games-soft',   solid: 'bg-games-bright',   edge: 'border-games-deep' },
  rewards: { icon: 'rewards', chip: 'bg-rewards-soft text-rewards-ink', bar: 'bg-rewards-bright', soft: 'bg-rewards-soft', solid: 'bg-rewards-bright', edge: 'border-rewards-deep' },
}

/** Rounded-square icon chip — the module's color identity, everywhere.
 *  The glyph inherits the chip's text color, so one hue drives tint AND icon. */
export function IconChip({ module: m, icon, size = 'md' }: {
  module: ModuleKey; icon?: IconName; size?: 'md' | 'lg' | 'xl'
}) {
  return <ClayIconChip ramp={m} icon={icon ?? MODULE[m].icon} size={size} />
}

/** Chunky activity tile — the tactile "press me" language of great kids'
 *  apps. Still exactly one hue per module, so color keeps carrying meaning. */
export function ModuleCard({ module: m, title, sub, href, icon, glyph, big, locked, lockedHint }: {
  module: ModuleKey; title: string; sub?: string; href: string
  icon?: IconName; glyph?: string; big?: boolean; locked?: boolean; lockedHint?: string
}) {
  return (
    <ClayTile
      ramp={m} icon={icon ?? MODULE[m].icon} glyph={glyph} title={title} sub={sub}
      href={href} big={big} locked={locked} lockedHint={lockedHint}
    />
  )
}

/** Primary CTA in the same chunky language (saffron, the brand hue).
 *  Thin wrapper kept so existing call sites read unchanged; new code should
 *  reach for ClayButton directly and pass a size rather than padding classes. */
export function ChunkyButton({ children, className = '' }: {
  children: React.ReactNode; className?: string
}) {
  return (
    <span
      style={clayVars('brand')}
      /* No text colour: `.clay` sets dark `--clay-ink` on the saffron fill
         (DESIGN_CHARTER.md — dark ink on bright, never white). */
      className={`clay inline-flex items-center justify-center gap-1.5 font-bold ${className}`}
    >
      {children}
    </span>
  )
}

/** Section heading with the module's accent tick — quiet, consistent. */
export function SectionTitle({ module: m, id, children }: { module?: ModuleKey; id?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {m && <span className={`w-1.5 h-5 rounded-full ${MODULE[m].bar}`} aria-hidden="true" />}
      {/* `id` so a <section> can point its aria-labelledby at the heading it
          already has, instead of repeating the label in an aria-label. */}
      <h2 id={id} className="font-bold text-text-primary text-base">{children}</h2>
    </div>
  )
}

/** Module-flavoured progress and labels — the material primitives with the
 *  vocabulary already applied, so pages never pass a raw ramp name. */
export function ModuleBar({ module: m, ...rest }: {
  module: ModuleKey; value: number; label: string; showValue?: boolean; className?: string
}) {
  return <ClayBar ramp={m} {...rest} />
}

export function ModuleChip({ module: m, icon, children }: {
  module: ModuleKey; icon?: IconName; children: React.ReactNode
}) {
  return <ClayChip ramp={m} icon={icon ?? MODULE[m].icon}>{children}</ClayChip>
}

export { ClayButton, Icon }
