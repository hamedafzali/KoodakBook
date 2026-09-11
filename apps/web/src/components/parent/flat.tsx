'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icons'
import type { Ramp } from '@/components/child/clay'

/* ── Flat: the PARENT app's material ────────────────────────────────────────
 *
 * The counterpart to components/child/clay.tsx. Clay is thick, coloured and
 * pressable because a five-year-old navigates by poking things. The parent is
 * scanning — often one-handed, often at 11pm, often only to answer "is this
 * working?" — so this register is calmer: soft rounded cards on a warm cream
 * ground, one gentle shadow, saffron accents, unhurried motion. Calmer than
 * the child side, but the SAME family — warm neutrals, the shared ramps, the
 * same icon set and type scale. Not the cold slate hairline sheet it used to
 * be (Phase 5).
 */

/** A soft card. The parent app's only container — still no "raised" variant,
 *  because "one raised element per screen" is a child-app rule for steering a
 *  pre-reader, and the parent is reading. One shadow level, warm border. */
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
      className={`bg-parent-surface border border-border rounded-2xl shadow-card p-4 ${className}`}
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

/** One of the numbers. A pastel card in the module's own hue with its emoji —
 *  the illustrated stat card the flatten pass replaced with a bare tinted box
 *  (Phase 5). Value sits in `ink` on `soft`, a pairing the ramp generator
 *  already solves for AA. `tabular-nums` so digits don't jitter between
 *  refreshes. */
export function Stat({
  ramp, icon, emoji, value, label,
}: {
  ramp: Ramp; icon: IconName; emoji?: string; value: number | string; label: string
}) {
  return (
    <div
      className="flex-1 min-w-[92px] rounded-2xl p-3 border"
      style={{ background: `var(--ramp-${ramp}-soft)`, borderColor: `var(--ramp-${ramp}-bright)` }}
    >
      {emoji
        ? <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
        : (
          <span style={{ color: `var(--ramp-${ramp}-ink)` }}>
            <Icon name={icon} size="sm" />
          </span>
        )}
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

/** Progress, parent register: thinner than the child's, no bounce, the fill
 *  eases rather than springs. Same accessibility contract as ClayBar — `label`
 *  is required, because a bare bar says nothing to a screen reader. */
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
      className={`h-2 rounded-full overflow-hidden bg-surface-subtle ${className}`}
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

/** The bar every parent screen opens with. One component so the back
 *  affordance is in the same place at the same size on every screen — what
 *  makes a back button feel reliable rather than decorative. */
export function PageHeader({
  title, subtitle, back, backLabel = 'برگشت', action,
}: {
  title: string
  subtitle?: string
  /** Omit for a screen with nowhere to go back to. */
  back?: string
  backLabel?: string
  action?: ReactNode
}) {
  return (
    <header className="bg-parent-surface border-b border-border px-5 py-4 flex items-center gap-3">
      {back && (
        <Link
          href={back}
          aria-label={backLabel}
          className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-parent-muted hover:text-parent-text hover:bg-surface-subtle transition-colors"
        >
          <Icon name="back" size="md" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-bold text-xl text-parent-text truncate">{title}</h1>
        {subtitle && <p className="text-sm text-parent-muted persian-text">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

/** A labelled group of rows — the settings idiom. A soft rounded card on the
 *  cream ground now (Phase 5), warm dividers instead of the cold slate sheet.
 *  The label is a real <h2> tied to the list with aria-labelledby: a parent
 *  using a screen reader navigates a settings screen by heading. */
export function Group({
  title, id, children, className = '',
}: {
  title: string; id: string; children: ReactNode; className?: string
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xs font-bold text-parent-muted uppercase tracking-wide mb-2 px-1">
        {title}
      </h2>
      <div className={`bg-parent-surface border border-border rounded-2xl shadow-card overflow-hidden ${className}`}>
        {children}
      </div>
    </section>
  )
}

/** One row inside a Group that goes somewhere. `href` renders a link,
 *  `onClick` a button — the distinction matters for keyboard and middle-click.
 *
 *  `icon` shows in a soft saffron chip on the leading side — a warm marker,
 *  not a bare grey stroke (Phase 5). The chevron points LEFT: in RTL, forward
 *  is left. It is the icon set's `forward`, so it can never disagree with the
 *  back chevron in PageHeader. */
export function NavRow({
  label, href, onClick, tone = 'default', value, icon,
}: {
  label: string
  href?: string
  onClick?: () => void
  /** `danger` for a destructive row; `brand` for the one additive action. */
  tone?: 'default' | 'brand' | 'danger'
  value?: ReactNode
  icon?: IconName
}) {
  const tint =
    tone === 'danger' ? 'text-rose-700 hover:bg-rose-50'
    : 'text-parent-text hover:bg-surface-subtle'

  const chipStyle =
    tone === 'danger'
      ? { background: '#FEE2E2', color: '#B91C1C' }
      : { background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }

  const inner = (
    <>
      <span className="flex items-center gap-3 min-w-0">
        {icon && (
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={chipStyle}
            aria-hidden="true"
          >
            <Icon name={icon} size="sm" />
          </span>
        )}
        <span className="font-medium text-sm truncate" style={tone === 'brand' ? { color: 'var(--ramp-brand-ink)' } : undefined}>
          {label}
        </span>
      </span>
      <span className="flex items-center gap-2 text-parent-muted shrink-0">
        {value}
        <Icon name="forward" size="sm" />
      </span>
    </>
  )
  const cls = `w-full flex items-center justify-between gap-3 px-5 py-4 min-h-[56px] text-right transition-colors ${tint}`

  return href
    ? <Link href={href} className={cls}>{inner}</Link>
    : <button onClick={onClick} className={cls}>{inner}</button>
}
