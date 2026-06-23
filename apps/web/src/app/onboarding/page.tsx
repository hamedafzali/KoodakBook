'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { setActiveChildId } from '@/lib/activeChild'
import Mascot from '@/components/child/Mascot'
import type { Child } from '@koodakbook/shared'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState<string | null>(null)
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

    if (res.error || !res.data) { setError(res.error ?? 'خطا'); setLoading(false); return }
    setActiveChildId(res.data.id)
    router.push('/onboarding/placement')
  }

  return (
    <div className="min-h-screen flex items-center justify-center child-bg p-4">
      <div className="bg-white rounded-[2rem] shadow-lg p-8 w-full max-w-sm">

        {/* Mascot + heading */}
        <div className="text-center mb-6">
          <motion.div
            className="flex justify-center mb-3"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Mascot size={80} mood="happy" />
          </motion.div>
          <h1 className="text-xl font-bold text-gray-800">معرفی کودک</h1>
          <p className="text-sm text-gray-500 mt-1 persian-text">بیایید با هم شروع کنیم 🚀</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="child-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              اسم کودک
            </label>
            <input
              id="child-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="given-name"
              className="w-full border border-gray-300 rounded-[0.875rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700 min-h-[48px]"
              placeholder="مثلاً لیلا"
            />
          </div>

          <div>
            <label htmlFor="birth-year" className="block text-sm font-medium text-gray-700 mb-1.5">
              سال تولد <span className="text-gray-400 font-normal">(اختیاری)</span>
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
              className="ltr w-full border border-gray-300 rounded-[0.875rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700 min-h-[48px] text-center"
              placeholder="2018"
            />
          </div>

          <div className="bg-amber-50 rounded-[0.875rem] p-3 flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden="true">🎮</span>
            <p className="text-xs text-amber-800 persian-text leading-relaxed">
              بعد از این، یک بازی کوتاه و آسان انجام می‌دهیم تا بفهمیم از کجا شروع کنیم.
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                role="alert"
                className="text-red-500 text-sm persian-text"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={loading || !name.trim()}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-[0.875rem] transition-colors disabled:opacity-50 text-lg min-h-[52px]"
          >
            {loading ? 'در حال ذخیره...' : 'بریم بازی کنیم! 🚀'}
          </motion.button>
        </form>
      </div>
    </div>
  )
}
