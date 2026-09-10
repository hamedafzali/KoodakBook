'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icons'
import type { Ramp } from '@/components/child/clay'

/* ── Flat: the PARENT app's material ────────────────────────────────────────
 *
 * The counterpart to components/child/clay.tsx, and deliberately its opposite.
 * Clay is thick, coloured and pressable because a five-year-old navigates by
 * poking things. The parent is scanning — often one-handed, often at 11pm,
 * often only to answer "is this working?" — so this register is flat surfaces,
 * hairline borders, tight density and calm motion. Toy-like depth on the
 * screen the buyer looks at reads as unserious.
 *
 * What the two registers SHARE is the system: the same icon set, the same type
 * scale, and the same 4-stop ramps. A `soft` ground with `ink` on top is
 * contrast-solved once and used by both. Only the material differs.
 */

/** A flat surface. This is the parent app's only container — there is no
 *  raised variant, because "one raised element per screen" is a child-app
 *  rule for directing a pre-reader's attention, and the parent is reading. */
export function Panel({
  title, action, children, className = '', labelledById,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  labelledById?: string
}) {
  return (
    <section
      aria-labelledby={title ? labelledById : undefined}
      className={`bg-parent-surface border border-slate-200 rounded-xl p-4 ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h2 id={labelledById} className="font-bold text-parent-text text-sm">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** One of the three numbers. Tinted from a shared ramp, so the value sits on
 *  `soft` in `ink` — a pairing the ramp generator already solves for AA.
 *  `tabular-nums` because these sit in a row and digits that jitter between
 *  refreshes read as noise. */
export function Stat({
  ramp, icon, value, label,
}: {
  ramp: Ramp; icon: IconName; value: number | string; label: string
}) {
  return (
    <div
      className="flex-1 min-w-[92px] rounded-xl p-3"
      style={{ background: `var(--ramp-${ramp}-soft)` }}
    >
      <span style={{ color: `var(--ramp-${ramp}-ink)` }}>
        <Icon name={icon} size="sm" />
      </span>
      <p
        className="text-2xl font-bold tabular-nums mt-1 leading-none"
        style={{ color: `var(--ramp-${ramp}-ink)` }}
      >
        {value}
      </p>
      <p className="text-xs text-parent-muted mt-1.5 leading-snug">{label}</p>
    </div>
  )
}

/** Progress, parent register: thinner than the child's, no bounce, and the
 *  fill eases rather than springs. Same accessibility contract as ClayBar —
 *  `label` is required, because a bare bar says nothing to a screen reader. */
export function FlatBar({
  value, label, ramp = 'brand', className = '',
}: {
  value: number; label: string; ramp?: Ramp; className?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      role="progressbar"
      aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className={`h-2 rounded-full overflow-hidden bg-slate-200 ${className}`}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: `var(--ramp-${ramp}-bright)` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
      />
    </div>
  )
}
