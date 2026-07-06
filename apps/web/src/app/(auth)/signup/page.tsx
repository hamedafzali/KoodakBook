'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { onSignIn } from '@/lib/auth'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await api.post<{ token: string }>('/api/auth/signup', { email, password })
    if (res.error || !res.data) { setError(res.error ?? 'مشکلی پیش آمد'); setLoading(false); return }

    onSignIn(res.data.token)
    // New account → parent panel: ParentGate forces a first-run PIN, then the
    // dashboard prompts the parent to create the first child profile.
    router.push('/parent/dashboard')
  }

  return (
    <div className="bg-white rounded-[2rem] shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-4xl mb-2" aria-hidden="true">🎈</p>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">شروع ماجراجویی فارسی</h1>
          <p className="text-gray-500 text-sm">رایگان است — نه کارت بانکی، نه تعهدی</p>
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
              placeholder="email@example.com"
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
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="حداقل ۶ کاراکتر"
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
            {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6 persian-text">
          حساب دارید؟{' '}
          <Link href="/login" className="text-amber-700 font-medium hover:underline">
            ورود
          </Link>
        </p>
        <p className="text-center text-[11px] text-gray-400 mt-4 persian-text leading-relaxed">
          با ثبت‌نام، <Link href="/terms" className="underline hover:text-amber-600">شرایط استفاده</Link> و{' '}
          <Link href="/privacy" className="underline hover:text-amber-600">حریم خصوصی</Link> را می‌پذیرید.
        </p>
    </div>
  )
}
