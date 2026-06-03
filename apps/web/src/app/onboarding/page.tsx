'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import Mascot from '@/components/child/Mascot'

const LEVELS = [
  { value: 1, label: 'هنوز فارسی بلد نیست', sublabel: 'تازه‌کار', emoji: '🌱' },
  { value: 2, label: 'چند کلمه فارسی می‌داند', sublabel: 'مبتدی', emoji: '🌿' },
  { value: 3, label: 'می‌تواند کمی بخواند', sublabel: 'متوسط', emoji: '🌳' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [level, setLevel] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isLoggedIn()) { router.push('/login'); return }
    setLoading(true)
    setError(null)

    const res = await api.post('/api/children', {
      name,
      birth_year: birthYear ? parseInt(birthYear) : null,
      level,
    })

    if (res.error) { setError(res.error); setLoading(false); return }
    router.push('/child/home')
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

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              سطح فارسی کودک
            </legend>
            <div className="space-y-2" role="radiogroup" aria-label="سطح فارسی کودک">
              {LEVELS.map(l => (
                <motion.button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={level === l.value}
                  onClick={() => setLevel(l.value)}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-[0.875rem] border-2 text-sm transition-colors min-h-[56px] ${
                    level === l.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-amber-300'
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">{l.emoji}</span>
                  <div className="text-right flex-1">
                    <span className={`block font-medium ${level === l.value ? 'text-amber-800' : 'text-gray-700'}`}>
                      {l.label}
                    </span>
                    <span className="text-xs text-gray-400">{l.sublabel}</span>
                  </div>
                  {level === l.value && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-amber-500 text-lg flex-shrink-0"
                      aria-hidden="true"
                    >
                      ✓
                    </motion.span>
                  )}
                </motion.button>
              ))}
            </div>
          </fieldset>

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
            {loading ? 'در حال ذخیره...' : 'شروع کنیم! 🚀'}
          </motion.button>
        </form>
      </div>
    </div>
  )
}
