'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { setActiveChildId } from '@/lib/activeChild'
import Mascot from '@/components/child/Mascot'
import { ClayButton } from '@/components/child/clay'
import type { Child } from '@koodakbook/shared'
import { Icon } from '@/components/icons'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isLoggedIn()) { router.push('/login'); return }
    setLoading(true)
    setError(null)

    // level starts at 1; the placement probe measures and updates it next.
    const res = await api.post<Child>('/api/children', {
      name,
      birth_year: birthYear ? parseInt(birthYear) : null,
      level: 1,
    })

    if (res.error || !res.data) {
      setError(res.error ?? 'خطا')
      // Plan child-limit reached → offer the plans page instead of a dead end.
      setLimitReached(!!res.error && res.error.includes('حداکثر'))
      setLoading(false)
      return
    }
    // Don't launch the assessment now — it runs the first time this child enters
    // child mode (child/home redirects to it while placement_done is false).
    setActiveChildId(res.data.id)
    router.push('/parent/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center child-bg p-4">
      <div className="bg-white rounded-[2rem] shadow-lg p-8 w-full max-w-sm">

        {/* Back to the parent panel — so adding a child (or hitting a plan limit)
            is never a dead end. */}
        <button
          type="button"
          onClick={() => router.push('/parent/dashboard')}
          className="flex items-center gap-1 min-h-[44px] text-sm font-bold text-text-secondary hover:text-brand-text transition-colors mb-1"
        >
          <span aria-hidden="true">→</span> بازگشت به پنل والدین
        </button>

        {/* Mascot + heading */}
        <div className="text-center mb-6">
          <motion.div
            className="flex justify-center mb-3"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Mascot size={80} mood="happy" />
          </motion.div>
          <h1 className="font-display font-black text-2xl text-text-primary">معرفی کودک</h1>
          <p className="text-sm text-text-secondary mt-1 persian-text">بیایید با هم شروع کنیم</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="child-name" className="block text-sm font-bold text-text-primary mb-1.5">
              اسم کودک
            </label>
            <input
              id="child-name"
              type="text"
              required
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              autoComplete="given-name"
              aria-invalid={!!error}
              aria-describedby={error ? 'onboarding-error' : undefined}
              className="w-full border-2 border-b-4 border-border rounded-[1rem] bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-text focus:border-[color:var(--ramp-brand-bright)] min-h-[52px]"
              placeholder="مثلاً لیلا"
            />
          </div>

          <div>
            <label htmlFor="birth-year" className="block text-sm font-bold text-text-primary mb-1.5">
              سال تولد <span className="text-text-secondary font-normal">(اختیاری)</span>
            </label>
            <input
              id="birth-year"
              type="number"
              dir="ltr"
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              min={2012}
              max={2025}
              autoComplete="bday-year"
              className="ltr w-full border-2 border-b-4 border-border rounded-[1rem] bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-text focus:border-[color:var(--ramp-brand-bright)] min-h-[52px] text-center"
              placeholder="2018"
            />
          </div>

          <div className="rounded-[1rem] p-3 flex items-center gap-2.5 border-2" style={{ background: 'var(--ramp-brand-soft)', borderColor: 'var(--ramp-brand-bright)' }}>
            <span style={{ color: 'var(--ramp-brand-ink)' }} aria-hidden="true"><Icon name="games" size="lg" /></span>
            <p className="text-sm persian-text leading-relaxed" style={{ color: 'var(--ramp-brand-ink)' }}>
              بعد از این، یک بازی کوتاه و آسان انجام می‌دهیم تا بفهمیم از کجا شروع کنیم.
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <p id="onboarding-error" className="text-red-700 text-sm persian-text">{error}</p>
                {limitReached && (
                  <button
                    type="button"
                    onClick={() => router.push('/parent/plan')}
                    className="w-full bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-2.5 rounded-[0.875rem] transition-colors text-sm min-h-[44px]"
                  >
                    مشاهده پلن‌ها و ارتقا
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clay, like every primary action on the child side: white on
              amber-500 measured ~2:1 (DESIGN_CHARTER: dark ink on bright). */}
          <ClayButton type="submit" size="lg" disabled={loading || !name.trim()}>
            {loading ? 'در حال ذخیره...' : 'بریم بازی کنیم!'}
          </ClayButton>
        </form>
      </div>
    </div>
  )
}
