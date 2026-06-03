'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { setToken } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await api.post<{ token: string }>('/api/auth/login', { email, password })
    if (res.error || !res.data) { setError('ایمیل یا رمز عبور اشتباه است'); setLoading(false); return }

    setToken(res.data.token)
    router.push('/parent/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
      <div className="bg-white rounded-[2rem] shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-amber-600 mb-1">KoodakBook</h1>
          <p className="text-gray-500 text-sm">ورود به حساب</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              ایمیل
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="ltr w-full border border-gray-300 rounded-[0.875rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700 min-h-[48px]"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              رمز عبور
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="ltr w-full border border-gray-300 rounded-[0.875rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700 min-h-[48px]"
            />
          </div>

          {error && (
            <p role="alert" className="text-red-500 text-sm persian-text">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-[0.875rem] transition-colors disabled:opacity-50 min-h-[52px] text-base"
          >
            {loading ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6 persian-text">
          حساب ندارید؟{' '}
          <Link href="/signup" className="text-amber-700 font-medium hover:underline">
            ثبت‌نام
          </Link>
        </p>
      </div>
    </div>
  )
}
