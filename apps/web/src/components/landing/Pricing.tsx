'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

/* Pricing synced from the backend plan catalogue (/api/plans) — the same rows
 * the admin plans panel manages. Change a price there, the site follows.
 * Paid plans are shown as «به‌زودی» until checkout ships. */

interface Plan {
  id: string
  key: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  interval: 'month' | 'year' | 'none'
  features: Record<string, string>
}

const fa = (n: number) => n.toLocaleString('fa-IR')

function price(p: Plan): string {
  if (p.price_cents === 0) return '۰€'
  const v = p.price_cents / 100
  return `${v.toLocaleString('fa-IR', { minimumFractionDigits: p.price_cents % 100 ? 2 : 0 })}€`
}

const INTERVAL: Record<Plan['interval'], string> = { month: '/ ماه', year: '/ سال', none: '— همیشه' }

/** Translate raw feature keys into parent-readable bullet lines. */
function featureLines(f: Record<string, string>): string[] {
  const lines: string[] = []
  if (f.max_children) lines.push(`${fa(Number(f.max_children))} پروفایل کودک`)
  lines.push('الفبا، صداکشی و درس‌های پایه')
  lines.push(f.full_story_library === 'true' ? 'تمام کتابخانه‌ی داستان' : 'چند داستان اول کتابخانه')
  if (f.ai_stories === 'true') {
    lines.push(f.ai_stories_per_day
      ? `داستان شخصی با هوش مصنوعی — روزی ${fa(Number(f.ai_stories_per_day))} داستان`
      : 'داستان‌های شخصی نامحدود با هوش مصنوعی')
  }
  if (f.co_read === 'true') lines.push('هم‌خوانی والد و کودک')
  if (f.record_voice === 'true') lines.push('ضبط صدای والدین روی واژه‌ها')
  lines.push('داشبورد پیشرفت والدین')
  return lines
}

export default function Pricing() {
  const [plans, setPlans] = useState<Plan[] | null>(null)

  useEffect(() => {
    api.get<Plan[]>('/api/plans').then(r => { if (r.data) setPlans(r.data) })
  }, [])

  if (!plans) return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-hidden="true">
      {[0, 1, 2].map(i => <div key={i} className="rounded-3xl bg-white border border-slate-200 h-72 animate-pulse" />)}
    </div>
  )

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map(p => {
        const free = p.price_cents === 0
        const highlight = p.key === 'premium'
        return (
          <div key={p.id}
            className={`relative rounded-3xl bg-white p-7 flex flex-col ${
              highlight ? 'border-2 border-amber-400 shadow-lg shadow-amber-100' : 'border border-slate-200'}`}>
            {highlight && (
              <span className="absolute -top-3.5 right-6 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">پیشنهاد خانواده‌ها</span>
            )}
            {p.interval === 'year' && (
              <span className="absolute -top-3.5 right-6 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">۲ ماه رایگان</span>
            )}
            <h3 className="font-bold text-xl">{p.name}</h3>
            <p className="text-3xl font-bold mt-2">
              {price(p)}<span className="text-sm font-normal text-slate-400"> {INTERVAL[p.interval]}</span>
            </p>
            {p.description && <p className="text-sm text-slate-500 mt-1">{p.description}</p>}
            <ul className="mt-5 space-y-2.5 text-sm text-slate-600 flex-1">
              {featureLines(p.features).map(l => <li key={l}>{free ? '✅' : '⭐'} {l}</li>)}
            </ul>
            {free ? (
              <Link href="/signup" className="block text-center mt-7 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition">
                شروع رایگان
              </Link>
            ) : (
              <span className="block text-center mt-7 bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-default select-none">
                به‌زودی
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
