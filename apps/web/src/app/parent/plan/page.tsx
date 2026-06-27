'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { containerWidths } from '@/components/shared/layout'
import { PLAN_FEATURES } from '@koodakbook/shared'

interface PlanRow {
  id: string
  key: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  interval: string
  features: Record<string, string>
}

const INTERVAL_LABEL: Record<string, string> = { month: 'ماه', year: 'سال', none: '' }

function priceLabel(p: PlanRow): string {
  if (p.price_cents === 0) return 'رایگان'
  const amount = (p.price_cents / 100).toLocaleString('fa-IR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const per = INTERVAL_LABEL[p.interval] ? ` / ${INTERVAL_LABEL[p.interval]}` : ''
  return `${amount} ${p.currency}${per}`
}

// Render a feature value: numbers as a count, booleans as a tick / dash.
function FeatureValue({ featureKey, type, value }: { featureKey: string; type: string; value: string }) {
  if (type === 'number') {
    return <span className="font-bold text-slate-800">{Number(value).toLocaleString('fa-IR')}</span>
  }
  return value === 'true'
    ? <span className="text-green-600 font-bold" aria-label="دارد">✓</span>
    : <span className="text-slate-300" aria-label="ندارد">—</span>
}

export default function PlanPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [plansRes, meRes] = await Promise.all([
        api.get<PlanRow[]>('/api/plans'),
        api.get<{ plan: string }>('/api/auth/me'),
      ])
      if (plansRes.data) setPlans(plansRes.data)
      if (meRes.data?.plan) setCurrentPlan(meRes.data.plan)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-gray-400 persian-text">در حال بارگذاری...</p>
    </div>
  )

  return (
    <div className={`min-h-screen bg-slate-50 pb-16 ${containerWidths.app}`}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center gap-3">
        <Link
          href="/parent/dashboard"
          aria-label="بازگشت به داشبورد"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </Link>
        <div>
          <h1 className="font-bold text-xl text-slate-800">پلن‌ها و اشتراک</h1>
          <p className="text-sm text-slate-400">امکانات هر پلن را مقایسه کنید</p>
        </div>
      </div>

      <div className="px-4 pt-5 grid gap-4 md:grid-cols-2">
        {plans.map(plan => {
          const isCurrent = plan.key === currentPlan
          const isPremium = plan.price_cents > 0
          return (
            <section
              key={plan.id}
              className={`bg-white rounded-lg shadow-sm overflow-hidden border-2 ${isCurrent ? 'border-amber-400' : 'border-transparent'}`}
              aria-labelledby={`plan-${plan.key}`}
            >
              <div className={`px-5 py-4 ${isPremium ? 'bg-brand-gradient text-white' : 'bg-slate-100'}`}>
                <div className="flex items-center justify-between">
                  <h2 id={`plan-${plan.key}`} className={`font-bold text-lg ${isPremium ? 'text-white' : 'text-slate-800'}`}>{plan.name}</h2>
                  {isCurrent && (
                    <span className="text-xs font-bold bg-white/90 text-amber-700 rounded-full px-2.5 py-1">پلن فعلی</span>
                  )}
                </div>
                <p className={`text-2xl font-extrabold mt-1 ${isPremium ? 'text-white' : 'text-slate-800'}`}>{priceLabel(plan)}</p>
                {plan.description && (
                  <p className={`text-sm mt-1 persian-text ${isPremium ? 'text-white/85' : 'text-slate-500'}`}>{plan.description}</p>
                )}
              </div>

              <ul className="divide-y divide-slate-100">
                {PLAN_FEATURES.map(def => (
                  <li key={def.key} className="flex items-center justify-between px-5 py-3 gap-3">
                    <span className="text-sm text-slate-600">{def.label}</span>
                    <FeatureValue featureKey={def.key} type={def.type} value={plan.features[def.key] ?? def.default} />
                  </li>
                ))}
              </ul>

              <div className="px-5 py-4">
                {isCurrent ? (
                  <button disabled className="w-full py-3 rounded-md bg-slate-100 text-slate-400 font-bold cursor-default min-h-[48px]">
                    پلن فعلی شما
                  </button>
                ) : isPremium ? (
                  <button disabled className="w-full py-3 rounded-md bg-amber-100 text-amber-700 font-bold cursor-default min-h-[48px]">
                    به‌زودی 🚀
                  </button>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>

      <p className="text-center text-xs text-slate-400 mt-6 px-6 persian-text">
        امکان ارتقای آنلاین به‌زودی اضافه می‌شود. فعلاً برای ارتقای پلن با پشتیبانی در تماس باشید.
      </p>
    </div>
  )
}
