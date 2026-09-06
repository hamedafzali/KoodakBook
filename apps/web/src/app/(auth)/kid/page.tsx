'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { onSignIn } from '@/lib/auth'
import { enterChildMode } from '@/lib/mode'
import { setActiveChildId } from '@/lib/activeChild'
import { getDeviceToken, setDeviceToken } from '@/lib/deviceToken'
import { playTap } from '@/lib/sounds'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import type { AppCharacter } from '@koodakbook/shared'

/* Kid login (mig 059): type your name, then — if a parent set one up — tap
 * your 3-character picture password instead of typing anything else. On an
 * already-bound device that's the whole flow; on a new device, a one-time
 * parent PIN check binds it so future logins here skip straight to the
 * picture step. No picture password set → the original one-tap flow.
 * The same username screen is the future hook point for face recognition
 * («دوربین من را می‌شناسد!»). */

type Step = 'name' | 'picture' | 'parent_pin'

export default function KidLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('name')
  const [username, setUsername] = useState('')
  const [child, setChild] = useState<{ id: string; name: string } | null>(null)
  const [characters, setCharacters] = useState<AppCharacter[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function finishLogin(token: string, childId: string, childName: string, deviceToken?: string) {
    onSignIn(token)
    enterChildMode()
    setActiveChildId(childId)
    if (deviceToken) setDeviceToken(childId, deviceToken)
    router.push('/child/home')
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const r = await api.post<{ token?: string; child_id: string; child_name: string; needs_picture_password?: boolean }>(
      '/api/auth/child-login', { username: username.trim() })
    setLoading(false)
    if (r.error || !r.data) { setError(r.error ?? 'یک مشکلی پیش آمد — دوباره امتحان کن'); return }

    if (r.data.needs_picture_password) {
      setChild({ id: r.data.child_id, name: r.data.child_name })
      const chars = await api.get<AppCharacter[]>('/api/characters')
      setCharacters(chars.data ?? [])
      setStep('picture')
      return
    }
    finishLogin(r.data.token!, r.data.child_id, r.data.child_name)
  }

  async function tapCharacter(slug: string) {
    if (!child || loading) return
    playTap()
    const next = [...picked, slug]
    setPicked(next)
    if (next.length < 3) return

    setLoading(true); setError(null)
    const r = await api.post<{ ok: boolean; locked?: boolean; needs_parent_pin?: boolean; token?: string; child_id: string; child_name: string }>(
      '/api/auth/child-login/verify-picture',
      { child_id: child.id, slugs: next, device_token: getDeviceToken(child.id) ?? undefined }
    )
    setLoading(false)
    if (r.error || !r.data) { setError('یک مشکلی پیش آمد — دوباره امتحان کن'); setPicked([]); return }

    if (!r.data.ok) {
      setPicked([])
      setError(r.data.locked
        ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن'
        : 'ترتیب درست نبود. دوباره امتحان کن')
      return
    }
    if (r.data.needs_parent_pin) {
      setPicked([])
      setStep('parent_pin')
      return
    }
    finishLogin(r.data.token!, r.data.child_id, r.data.child_name)
  }

  async function submitParentPin(e: React.FormEvent) {
    e.preventDefault()
    if (!child) return
    setLoading(true); setError(null)
    const r = await api.post<{ ok: boolean; locked?: boolean; token?: string; device_token?: string; child_id: string; child_name: string }>(
      '/api/auth/child-login/bind-device', { child_id: child.id, pin }
    )
    setLoading(false)
    if (r.error || !r.data) { setError('یک مشکلی پیش آمد — دوباره امتحان کن'); return }
    if (!r.data.ok) {
      setPin('')
      setError(r.data.locked ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن' : 'پین اشتباه است')
      return
    }
    finishLogin(r.data.token!, r.data.child_id, r.data.child_name, r.data.device_token)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-amber-50 to-amber-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <AnimatePresence mode="wait">
          {step === 'name' && (
            <motion.div key="name" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.p
                className="text-7xl mb-4 select-none"
                animate={{ y: [0, -10, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              >🐣</motion.p>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">سلام! تو کی هستی؟</h1>
              <p className="text-slate-500 persian-text mb-7">اسم مخصوصت را بنویس — همانی که مامان یا بابا برایت ساخته 🎈</p>

              <form onSubmit={submitName} className="space-y-4" noValidate>
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
            </motion.div>
          )}

          {step === 'picture' && (
            <motion.div key="picture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-2xl font-bold text-slate-800 mb-1">سلام {child?.name}! 👋</h1>
              <p className="text-slate-500 persian-text mb-2">۳ دوستت را به ترتیب لمس کن</p>

              {/* Picked-so-far strip — lets a child see progress without any text/numbers. */}
              <div className="flex justify-center gap-2 mb-5" aria-hidden="true">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`w-3 h-3 rounded-full ${i < picked.length ? 'bg-amber-500' : 'bg-white border-2 border-amber-200'}`} />
                ))}
              </div>

              {error && <p role="alert" className="text-red-500 text-sm persian-text mb-4">{error}</p>}

              <div className="grid grid-cols-3 gap-4">
                {characters.map(c => (
                  <motion.button
                    key={c.slug}
                    onClick={() => tapCharacter(c.slug)}
                    disabled={loading}
                    whileTap={{ scale: 0.9 }}
                    aria-label={c.name_persian}
                    className="bg-white rounded-2xl p-2 shadow-sm hover:shadow-md transition-shadow disabled:opacity-50 touch-target"
                  >
                    <CharacterAvatar slug={c.slug} size={72} />
                  </motion.button>
                ))}
              </div>

              <button
                onClick={() => { setStep('name'); setPicked([]); setError(null) }}
                className="mt-6 text-xs text-slate-400 hover:text-amber-600 transition-colors"
              >
                اسم دیگری وارد کنم
              </button>
            </motion.div>
          )}

          {step === 'parent_pin' && (
            <motion.div key="parent_pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-4xl mb-4">🔒</div>
              <h1 className="text-xl font-bold text-slate-800 mb-1">این دستگاه جدید است</h1>
              <p className="text-slate-500 persian-text mb-6 text-sm">
                برای اولین ورود {child?.name} روی این دستگاه، از مامان یا بابا بخواه پین را وارد کند
              </p>
              <form onSubmit={submitParentPin} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(null) }}
                  placeholder="••••"
                  dir="ltr"
                  className="ltr w-full text-center text-3xl tracking-[0.5em] border-4 border-amber-300 rounded-[1.5rem] px-4 py-4 bg-white focus:outline-none focus:border-amber-500 min-h-[64px]"
                  aria-label="پین والدین"
                />
                {error && <p role="alert" className="text-red-500 text-sm persian-text">{error}</p>}
                <motion.button
                  type="submit" disabled={loading || pin.length < 4}
                  whileTap={{ scale: 0.96 }}
                  className="w-full bg-brand-gradient text-white font-bold text-xl py-4 rounded-[1.5rem] shadow-lg disabled:opacity-50 min-h-[64px]"
                >
                  {loading ? '...' : 'تأیید'}
                </motion.button>
              </form>
              <button
                onClick={() => { setStep('name'); setPin(''); setError(null) }}
                className="mt-6 text-xs text-slate-400 hover:text-amber-600 transition-colors"
              >
                بازگشت
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
