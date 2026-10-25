'use client'
import type { ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import { fa } from '@/lib/csv'

/* Building blocks for the Reports pages: KPI cards, a trend chart with axis
 * labels and hover values, segmented controls, and progress rows. Plain SVG
 * and Tailwind, like components/charts.tsx — no chart library. */

export function KpiCard({ label, value, hint, delta, icon, tone = 'slate' }: {
  label: string
  value: number | string | null | undefined
  hint?: string
  /** Change vs the previous period, as a ratio (0.25 = +25%). */
  delta?: number | null
  icon?: IconName
  tone?: 'slate' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
}) {
  const toneCls = {
    slate: 'bg-slate-100 text-slate-500', amber: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600', violet: 'bg-violet-100 text-violet-600',
    sky: 'bg-sky-100 text-sky-600', rose: 'bg-rose-100 text-rose-600',
  }[tone]
  const shown = typeof value === 'number' ? fa(value) : value ?? '—'
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 truncate">{label}</span>
        {icon && <span className={`w-8 h-8 rounded-xl grid place-items-center ${toneCls}`}><Icon name={icon} size={16} /></span>}
      </div>
      <div className="text-2xl font-bold text-slate-800 tabular-nums">{shown}</div>
      <div className="flex items-center gap-2 text-[11px] min-h-4">
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span className={`inline-flex items-center gap-0.5 font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            <Icon name={delta >= 0 ? 'up' : 'down'} size={12} />
            {fa(Math.round(Math.abs(delta) * 100))}٪
          </span>
        )}
        {hint && <span className="text-slate-400 truncate">{hint}</span>}
      </div>
    </div>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
      {options.map(o => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${o.value === value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Panel({ title, subtitle, actions, children, className = '' }: {
  title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/** Multi-series daily trend. The plot stretches to the panel's full width
 *  (preserveAspectRatio="none", non-scaling strokes); the axis labels are
 *  HTML so they never stretch with it. Hovering a day shows every series'
 *  value for that day. Time runs left to right, as on every chart. */
export function TrendChart({ labels, series, height = 200 }: {
  labels: string[]
  series: { name: string; color: string; points: number[] }[]
  height?: number
}) {
  const n = Math.max(1, labels.length)
  const max = Math.max(1, ...series.flatMap(s => s.points))
  const W = 1000, H = 100
  const x = (i: number) => (n === 1 ? W / 2 : (i * W) / (n - 1))
  const y = (v: number) => H - (v / max) * H
  const ticks = n <= 5 ? labels.map((_, i) => i) : [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round(3 * (n - 1) / 4), n - 1]
  const first = series[0]
  return (
    <div dir="ltr">
      <div className="flex gap-2">
        <div className="relative flex-1" style={{ height }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible"
            role="img" aria-label={series.map(s => `${s.name}: ${s.points.reduce((a, b) => a + b, 0)}`).join('، ')}>
            {[0, 0.5, 1].map(t => (
              <line key={t} x1={0} x2={W} y1={y(max * t)} y2={y(max * t)} stroke="#f1f5f9" vectorEffect="non-scaling-stroke" />
            ))}
            {first && first.points.length > 1 && (
              <polygon fill={first.color} opacity={0.08}
                points={`${x(0)},${H} ${first.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} ${x(first.points.length - 1)},${H}`} />
            )}
            {series.map(s => (
              <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            ))}
          </svg>
          {/* One hover target per day, carrying that day's values. */}
          <div className="absolute inset-0 flex">
            {labels.map((l, i) => (
              <div key={i} className="flex-1 hover:bg-slate-400/10 rounded-sm"
                title={`${l}\n${series.map(s => `${s.name}: ${s.points[i] ?? 0}`).join('\n')}`} />
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between text-[10px] text-slate-400 tabular-nums w-6 shrink-0" style={{ height }}>
          <span>{fa(max)}</span><span>{fa(max / 2, 1)}</span><span>{fa(0)}</span>
        </div>
      </div>
      <div className="relative h-4 mt-1 me-8 text-[10px] text-slate-400">
        {ticks.map(i => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${n === 1 ? 50 : (i / (n - 1)) * 100}%` }}>
            {labels[i]?.slice(5)}
          </span>
        ))}
      </div>
      <div dir="rtl" className="flex flex-wrap gap-4 text-xs mt-2">
        {series.map(s => (
          <span key={s.name} className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.name}
            <span className="text-slate-400 tabular-nums">({fa(s.points.reduce((a, b) => a + b, 0))})</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** A labelled share: "47 of 120 · 39%" with a bar. */
export function ProgressRow({ label, value, total, color = '#f59e0b' }: { label: string; value: number; total: number; color?: string }) {
  const p = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1 gap-2">
        <span className="text-slate-600 truncate">{label}</span>
        {/* Two spans, not "a از b · p٪": the middle dot reads as a Persian zero. */}
        <span className="flex items-center gap-2 shrink-0 tabular-nums">
          <span className="text-slate-400">{fa(value)} از {fa(total)}</span>
          <span className="text-slate-600 font-semibold bg-slate-100 rounded-md px-1.5">{fa(Math.round(p))}٪</span>
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  )
}

/** Simple sortable-looking table with sticky header; rows are plain records. */
export function DataGrid<T extends Record<string, unknown>>({ rows, columns, empty = 'داده‌ای نیست' }: {
  rows: T[]
  columns: { key: keyof T; label: string; align?: 'start' | 'end'; render?: (row: T) => ReactNode }[]
  empty?: string
}) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 border-b border-slate-100">
            {columns.map((c, ci) => (
              <th key={ci} className={`font-medium py-2 px-1 ${c.align === 'end' ? 'text-left' : 'text-right'}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              {columns.map((c, ci) => (
                <td key={ci} className={`py-2 px-1 text-slate-600 ${c.align === 'end' ? 'text-left tabular-nums' : 'text-right'}`}>
                  {c.render ? c.render(r) : (typeof r[c.key] === 'number' ? fa(r[c.key] as number) : String(r[c.key] ?? '—'))}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length} className="text-center text-slate-400 py-4">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
