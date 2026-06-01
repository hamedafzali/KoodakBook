'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

    // verify admin access
    const token = res.data.token
    setToken(token)
    const check = await api.get<{ admin: boolean }>('/api/admin/me')
    if (check.error || !check.data?.admin) {
      setError('این حساب دسترسی ادمین ندارد')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-center text-amber-600 mb-1">KoodakBook</h1>
        <p className="text-center text-gray-400 text-sm mb-6">پنل مدیریت</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" required placeholder="ایمیل" value={email} onChange={e => setEmail(e.target.value)}
            className="ltr w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <input type="password" required placeholder="رمز عبور" value={password} onChange={e => setPassword(e.target.value)}
            className="ltr w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition disabled:opacity-50">
            {loading ? '...' : 'ورود'}
          </button>
        </form>
      </div>
    </div>
  )
}
