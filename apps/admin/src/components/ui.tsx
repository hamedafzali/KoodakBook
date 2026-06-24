'use client'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/* ── Button ─────────────────────────────────────────────── */
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  danger: 'bg-red-500 hover:bg-red-600 text-white shadow-sm',
  ghost: 'text-slate-500 hover:bg-slate-100',
}
export function Button({ variant = 'primary', className = '', children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button {...rest}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANT[variant]} ${className}`}>
      {children}
    </button>
  )
}

/* ── Card ───────────────────────────────────────────────── */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-white rounded-2xl border border-slate-200/70 shadow-sm ${className}`}>{children}</div>
}

/* ── Page header ────────────────────────────────────────── */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ── Section ────────────────────────────────────────────── */
export function Section({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="font-bold text-slate-700 text-sm mb-2">{title}</h3>
      {children}
    </section>
  )
}

/* ── Badge ──────────────────────────────────────────────── */
type Tone = 'gray' | 'green' | 'amber' | 'red' | 'violet' | 'blue' | 'emerald'
const TONE: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-500', green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
  violet: 'bg-violet-100 text-violet-700', blue: 'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
}
export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${TONE[tone]}`}>{children}</span>
}

/* ── States ─────────────────────────────────────────────── */
export function Spinner({ label = 'در حال بارگذاری...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
      <span className="w-4 h-4 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
      {label}
    </div>
  )
}
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-center text-slate-400 text-sm py-8">{children}</p>
}

/* ── Stat tile ──────────────────────────────────────────── */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <Card className="p-4 text-center">
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </Card>
  )
}
