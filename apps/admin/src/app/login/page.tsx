'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { setToken } from '@/lib/auth'
import { Button } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await api.post<{ token: string }>('/api/auth/login', { email, password })
    if (res.error || !res.data) { setError('ایمیل یا رمز عبور اشتباه است'); setLoading(false); return }
    setToken(res.data.token)
    const check = await api.get<{ admin: boolean }>('/api/admin/me')
    if (check.error || !check.data?.admin) { setError('این حساب دسترسی ادمین ندارد'); setLoading(false); return }
    router.push('/dashboard')
  }

  const inp = 'ltr w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-slate-100 p-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white font-bold text-xl flex items-center justify-center mx-auto mb-3">ک</div>
          <h1 className="text-lg font-bold text-slate-800">KoodakBook</h1>
          <p className="text-slate-400 text-sm">پنل مدیریت</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" required placeholder="ایمیل" value={email} onChange={e => setEmail(e.target.value)} className={inp} />
          <input type="password" required placeholder="رمز عبور" value={password} onChange={e => setPassword(e.target.value)} className={inp} />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full py-3">{loading ? '...' : 'ورود'}</Button>
        </form>
      </div>
    </div>
  )
}
