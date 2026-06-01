'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'

const LEVELS = [
  { value: 1, label: 'هنوز فارسی بلد نیست', emoji: '🌱' },
  { value: 2, label: 'چند کلمه فارسی می‌داند', emoji: '🌿' },
  { value: 3, label: 'می‌تواند کمی بخواند', emoji: '🌳' },
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
    <div className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">👶</div>
          <h1 className="text-xl font-bold text-gray-800">معرفی کودک</h1>
          <p className="text-sm text-gray-500 mt-1">بیایید با هم شروع کنیم</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم کودک</label>
            <input
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="مثلاً لیلا"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">سال تولد (اختیاری)</label>
            <input
              type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)}
              min={2012} max={2025}
              className="ltr w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="2018"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">سطح فارسی</label>
            <div className="space-y-2">
              {LEVELS.map(l => (
                <button key={l.value} type="button" onClick={() => setLevel(l.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition ${
                    level === l.value ? 'border-amber-500 bg-amber-50 font-medium' : 'border-gray-200 hover:border-amber-300'
                  }`}>
                  <span className="text-2xl">{l.emoji}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 text-lg">
            {loading ? '...' : 'شروع کنیم! 🚀'}
          </button>
        </form>
      </div>
    </div>
  )
}
