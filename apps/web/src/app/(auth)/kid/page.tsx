'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { onSignIn } from '@/lib/auth'
import { enterChildMode } from '@/lib/mode'
import { setActiveChildId } from '@/lib/activeChild'

/* Kid login: type your name, start playing. No password (kids can't type
 * them) — the parent area stays behind the PIN. The same screen is the future
 * hook point for face recognition («دوربین من را می‌شناسد!»). */

export default function KidLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const r = await api.post<{ token: string; child_id: string; child_name: string }>(
      '/api/auth/child-login', { username: username.trim() })
    setLoading(false)
    if (r.error || !r.data) { setError(r.error ?? 'یک مشکلی پیش آمد — دوباره امتحان کن'); return }
    onSignIn(r.data.token)
    enterChildMode()               // straight to child mode; parent area stays PIN-locked
    setActiveChildId(r.data.child_id)
    router.push('/child/home')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-amber-50 to-amber-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <motion.p
          className="text-7xl mb-4 select-none"
          animate={{ y: [0, -10, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >🐣</motion.p>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">سلام! تو کی هستی؟</h1>
        <p className="text-slate-500 persian-text mb-7">اسم مخصوصت را بنویس — همانی که مامان یا بابا برایت ساخته 🎈</p>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="sara2018"
            dir="ltr"
            autoCapitalize="none"
            autoComplete="username"
            className="ltr w-full text-center text-2xl font-bold tracking-wide border-4 border-amber-300 rounded-[1.5rem] px-4 py-4 bg-white focus:outline-none focus:border-amber-500 min-h-[64px]"
            aria-label="اسم مخصوص تو"
          />
          {error && <p role="alert" className="text-red-500 text-sm persian-text">{error}</p>}
          <motion.button
            type="submit" disabled={loading || username.trim().length < 3}
            whileTap={{ scale: 0.96 }}
            className="w-full bg-brand-gradient text-white font-bold text-xl py-4 rounded-[1.5rem] shadow-lg disabled:opacity-50 min-h-[64px]"
          >
            {loading ? 'دارم می‌آیم…' : 'بریم بازی! 🎈'}
          </motion.button>
        </form>

        <p className="text-sm text-slate-400 mt-8 persian-text">
          اسم مخصوص نداری؟ از مامان یا بابا بخواه در تنظیمات برایت بسازد.
        </p>
        <Link href="/login" className="inline-block mt-3 text-sm font-bold text-slate-500 hover:text-amber-600">
          ورود والدین ←
        </Link>
      </div>
    </div>
  )
}
