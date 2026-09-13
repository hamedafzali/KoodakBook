'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { containerWidths } from '@/components/shared/layout'
import { PLAN_FEATURES } from '@koodakbook/shared'
import { Icon } from '@/components/icons'
import { PageHeader } from '@/components/parent/flat'

interface PlanRow {
  id: string
  key: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  interval: string
  purchasable: boolean
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
    return <span className="font-bold text-parent-text tabular-nums">{Number(value).toLocaleString('fa-IR')}</span>
  }
  /* A dash for "not included" rather than a red cross: this is a comparison
   * table, not a report card, and the absent row shouldn't read as a failure.
   * It still carries an aria-label, because a dash reads as nothing. */
  return value === 'true'
    ? <span className="text-emerald-700" role="img" aria-label="دارد"><Icon name="done" size="sm" strokeWidth={3} /></span>
    : <span className="text-parent-muted" role="img" aria-label="ندارد">—</span>
}

export default function PlanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-parent-bg">
        <p className="text-parent-muted persian-text">در حال بارگذاری...</p>
      </div>
    }>
      <PlanPageInner />
    </Suspense>
  )
}

function PlanPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // ?checkout=success|cancel — set by Stripe's redirect back from a Checkout
  // Session (see success_url/cancel_url in routes/billing.ts). Read once on
  // mount; the webhook (not this page) is what actually updates the plan, so
  // "success" here just means "you made it back", not "you're upgraded yet" —
  // hence the softer wording below.
  const [checkoutNotice] = useState(searchParams.get('checkout'))

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

  async function startCheckout() {
    setError(null)
    setRedirecting('checkout')
    const res = await api.post<{ url: string }>('/api/billing/checkout', {})
    if (res.data?.url) {
      window.location.href = res.data.url
      return
    }
    setError(res.error ?? 'خطایی پیش آمد. دوباره تلاش کنید')
    setRedirecting(null)
  }

  async function openBillingPortal() {
    setError(null)
    setRedirecting('portal')
    const res = await api.post<{ url: string }>('/api/billing/portal', {})
    if (res.data?.url) {
      window.location.href = res.data.url
      return
    }
    setError(res.error ?? 'خطایی پیش آمد. دوباره تلاش کنید')
    setRedirecting(null)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-parent-bg">
      <p className="text-parent-muted persian-text">در حال بارگذاری...</p>
    </div>
  )

  const currentIsPaid = plans.some(p => p.key === currentPlan && p.price_cents > 0)

  return (
    <div className={`min-h-screen bg-parent-bg pb-16 ${containerWidths.app}`}>
      <PageHeader
        title="پلن‌ها و اشتراک"
        subtitle="امکانات هر پلن را مقایسه کنید"
        back="/parent/dashboard"
        backLabel="بازگشت به داشبورد"
      />

      {checkoutNotice === 'success' && (
        <div role="status" className="mx-4 mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-sm text-emerald-800 persian-text">
            پرداخت شما ثبت شد. فعال‌سازی پلن معمولاً چند ثانیه طول می‌کشد — اگر این صفحه را رفرش کنید باید به‌روز شده باشد.
          </p>
        </div>
      )}
      {checkoutNotice === 'cancel' && (
        <div role="status" className="mx-4 mt-4 rounded-xl bg-surface-subtle border border-border px-4 py-3">
          <p className="text-sm text-parent-muted persian-text">پرداخت لغو شد. هر وقت خواستید می‌توانید دوباره تلاش کنید.</p>
        </div>
      )}
      {error && (
        <div className="mx-4 mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p role="alert" className="text-sm text-red-600 persian-text">{error}</p>
        </div>
      )}

      <div className="px-4 pt-5 grid gap-4 md:grid-cols-2">
        {plans.map(plan => {
          const isCurrent = plan.key === currentPlan
          const isPremium = plan.price_cents > 0
          /* The current plan is marked by a full-weight border in the brand
           * ramp; every other card sits on the hairline the rest of the parent
           * app uses. Nothing here is a gradient any more — the premium card
           * was the one place in the parent register still shouting, and a
           * paid tier doesn't need to. */
          return (
            <section
              key={plan.id}
              className="bg-parent-surface rounded-xl overflow-hidden border"
              style={{
                borderColor: isCurrent ? 'var(--ramp-brand-bright)' : 'rgb(226 232 240)',
                borderWidth: isCurrent ? 2 : 1,
              }}
              aria-labelledby={`plan-${plan.key}`}
            >
              <div
                className="px-5 py-4"
                style={{ background: isPremium ? 'var(--ramp-brand-soft)' : undefined }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 id={`plan-${plan.key}`} className="font-bold text-lg text-parent-text">{plan.name}</h2>
                  {isCurrent && (
                    <span
                      className="text-xs font-bold rounded-full px-2.5 py-1 shrink-0"
                      style={{ background: 'var(--ramp-brand-bright)', color: '#fff' }}
                    >پلن فعلی</span>
                  )}
                </div>
                <p className="text-2xl font-extrabold mt-1 text-parent-text tabular-nums">{priceLabel(plan)}</p>
                {plan.description && (
                  <p className="text-sm mt-1 persian-text text-parent-muted">{plan.description}</p>
                )}
              </div>

              <ul className="divide-y divide-border">
                {PLAN_FEATURES.map(def => (
                  <li key={def.key} className="flex items-center justify-between px-5 py-3 gap-3">
                    <span className="text-sm text-parent-text">{def.label}</span>
                    <FeatureValue featureKey={def.key} type={def.type} value={plan.features[def.key] ?? def.default} />
                  </li>
                ))}
              </ul>

              <div className="px-5 py-4">
                {isCurrent ? (
                  isPremium ? (
                    <button
                      onClick={openBillingPortal}
                      disabled={redirecting !== null}
                      className="w-full py-3 rounded-xl bg-surface-subtle text-parent-text font-bold min-h-[48px] disabled:opacity-50 touch-target"
                    >
                      {redirecting === 'portal' ? 'در حال انتقال...' : 'مدیریت اشتراک'}
                    </button>
                  ) : (
                    <button disabled className="w-full py-3 rounded-xl bg-surface-subtle text-parent-muted font-bold cursor-default min-h-[48px]">
                      پلن فعلی شما
                    </button>
                  )
                ) : isPremium ? (
                  plan.purchasable ? (
                    <button
                      onClick={startCheckout}
                      disabled={redirecting !== null}
                      className="w-full py-3 rounded-xl font-bold min-h-[48px] disabled:opacity-50 touch-target"
                      style={{ background: 'var(--ramp-brand-bright)', color: '#fff' }}
                    >
                      {redirecting === 'checkout' ? 'در حال انتقال...' : 'شروع اشتراک'}
                    </button>
                  ) : (
                    <button disabled
                      className="w-full py-3 rounded-xl font-bold cursor-default min-h-[48px]"
                      style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }}>
                      به‌زودی
                    </button>
                  )
                ) : null}
              </div>
            </section>
          )
        })}
      </div>

      {!currentIsPaid && (
        <p className="text-center text-xs text-parent-muted mt-6 px-6 persian-text">
          پرداخت با کارت بین‌المللی از طریق Stripe انجام می‌شود. هر زمان می‌توانید اشتراک را از همین صفحه لغو کنید.
        </p>
      )}
    </div>
  )
}
