'use client'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/* Centralized web style kit (built on the globals.css design tokens). Replaces
 * the inline `bg-white rounded-[1.75rem] shadow-sm` / amber-gradient button
 * strings duplicated across the child + parent pages. */
export const ui = {
  card: 'bg-white rounded-[1.75rem] shadow-sm',
  cardLg: 'bg-white rounded-[2rem] shadow-md',
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`${ui.card} ${className}`}>{children}</div>
}

type Variant = 'primary' | 'secondary'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md',
  secondary: 'bg-white border-2 border-slate-200 text-slate-700',
}
export function Button({ variant = 'primary', className = '', children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button {...rest}
      className={`inline-flex items-center justify-center gap-2 font-bold rounded-[1.25rem] py-3 px-5 text-base transition-transform active:scale-95 disabled:opacity-50 ${VARIANT[variant]} ${className}`}>
      {children}
    </button>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-bold text-gray-800 text-base">{children}</h2>
      {action}
    </div>
  )
}
