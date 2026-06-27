'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { markParentUnlocked, isParentUnlocked } from '@/lib/auth'
import { setMode } from '@/lib/mode'

const PIN_LENGTH = 4

type State = 'loading' | 'set_pin' | 'enter_pin' | 'reset' | 'unlocked'

interface Props {
  children: React.ReactNode
}

export default function ParentGate({ children }: Props) {
  const [state, setState] = useState<State>('loading')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'first' | 'confirm'>('first')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Decide whether this account needs to set a first-run PIN or enter its
  // existing one. The PIN now lives on the account (server), not the device.
  useEffect(() => {
    // "Change PIN" from settings re-locks and lands here in reset mode.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pin') === 'reset') {
      setState('reset'); return
    }
    if (isParentUnlocked()) { setState('unlocked'); return }
    let alive = true
    api.get<{ has_pin: boolean }>('/api/auth/me').then(res => {
      if (!alive) return
      // No data → the session is dead; the api client has already sent us to /login.
      if (res.data) setState(res.data.has_pin ? 'enter_pin' : 'set_pin')
    })
    return () => { alive = false }
  }, [])

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  function unlock() {
    markParentUnlocked()
    setMode('parent')   // entering the parent area is the moment we're in parent mode
    setState('unlocked')
  }

  async function verify(entered: string) {
    setBusy(true)
    const res = await api.post<{ ok: boolean; locked?: boolean }>('/api/auth/pin/verify', { pin: entered })
    setBusy(false)
    if (res.data?.ok) { unlock(); return }
    triggerShake()
    setError(res.data?.locked
      ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کنید'
      : 'پین اشتباه است. دوباره تلاش کنید')
    setTimeout(() => setPin(''), 500)
  }

  async function savePin(p: string, c: string) {
    if (p !== c) {
      triggerShake()
      setError('پین‌ها مطابقت ندارند. دوباره امتحان کنید')
      setStep('first'); setPin(''); setConfirmPin('')
      return
    }
    setBusy(true)
    const res = await api.post<{ ok: boolean }>('/api/auth/pin/set', { pin: p })
    setBusy(false)
    if (res.data?.ok) { unlock(); return }
    // A PIN already exists (e.g. set in another tab) → fall back to entering it.
    setStep('first'); setPin(''); setConfirmPin(''); setError(null)
    setState('enter_pin')
  }

  function handleDigit(d: string) {
    if (busy) return
    setError(null)
    if (state === 'enter_pin') {
      const next = pin + d
      if (next.length <= PIN_LENGTH) {
        setPin(next)
        if (next.length === PIN_LENGTH) verify(next)
      }
    } else if (state === 'set_pin') {
      if (step === 'first') {
        const next = pin + d
        if (next.length <= PIN_LENGTH) {
          setPin(next)
          if (next.length === PIN_LENGTH) setStep('confirm')
        }
      } else {
        const next = confirmPin + d
        if (next.length <= PIN_LENGTH) {
          setConfirmPin(next)
          if (next.length === PIN_LENGTH) savePin(pin, next)
        }
      }
    }
  }

  function handleDelete() {
    if (busy) return
    setError(null)
    if (state === 'enter_pin') setPin(p => p.slice(0, -1))
    else if (step === 'first') setPin(p => p.slice(0, -1))
    else setConfirmPin(p => p.slice(0, -1))
  }

  // Forgot PIN → clear it with the account password (a child can't bypass it),
  // then the account has no PIN so we drop into first-run set.
  async function submitReset(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await api.post<{ ok: boolean }>('/api/auth/pin/reset', { password })
    setBusy(false)
    if (res.data?.ok) {
      setPassword(''); setPin(''); setConfirmPin(''); setStep('first')
      setState('set_pin')
      return
    }
    triggerShake()
    setError('رمز عبور اشتباه است')
  }

  const currentPin = state === 'enter_pin' ? pin : step === 'first' ? pin : confirmPin

  if (state === 'loading') return null
  if (state === 'unlocked') return <>{children}</>

  // ── Reset screen (password) ──
  if (state === 'reset') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-6">
        <motion.div
          ref={containerRef}
          animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-[2rem] p-8 w-full max-w-xs shadow-2xl text-center"
        >
          <div className="text-4xl mb-4">🔑</div>
          <h1 className="font-bold text-xl text-gray-800 mb-1">بازنشانی پین</h1>
          <p className="text-sm text-gray-500 mb-6">برای امنیت، رمز عبور حساب را وارد کنید</p>
          <form onSubmit={submitReset} className="space-y-4">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null) }}
              placeholder="رمز عبور"
              className="ltr w-full border border-gray-300 rounded-[0.875rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 min-h-[48px]"
            />
            {error && <p role="alert" className="text-red-500 text-sm persian-text">{error}</p>}
            <button
              type="submit"
              disabled={busy || password.length < 6}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-[0.875rem] transition-colors disabled:opacity-50 min-h-[48px]"
            >
              {busy ? '...' : 'تأیید و تنظیم پین جدید'}
            </button>
          </form>
          <button
            onClick={() => { setState('enter_pin'); setPassword(''); setError(null) }}
            className="mt-4 text-xs text-gray-400 hover:text-amber-600 transition-colors"
          >
            انصراف
          </button>
        </motion.div>
      </div>
    )
  }

  const titleText = state === 'set_pin'
    ? step === 'first' ? 'پین والدین را تنظیم کنید' : 'پین را تأیید کنید'
    : 'پین والدین را وارد کنید'

  const subtitleText = state === 'set_pin'
    ? step === 'first' ? 'یک پین ۴ رقمی انتخاب کنید' : 'پین را دوباره وارد کنید'
    : 'این بخش برای والدین است'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-6">
      <motion.div
        ref={containerRef}
        animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-[2rem] p-8 w-full max-w-xs shadow-2xl text-center"
      >
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="font-bold text-xl text-gray-800 mb-1">{titleText}</h1>
        <p className="text-sm text-gray-500 mb-6">{subtitleText}</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-6" aria-label={`پین وارد شده: ${currentPin.length} از ${PIN_LENGTH} رقم`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-4 h-4 rounded-full border-2 ${
                i < currentPin.length
                  ? 'bg-amber-500 border-amber-500'
                  : 'bg-transparent border-gray-300'
              }`}
              animate={i < currentPin.length ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.p
              className="text-red-500 text-sm mb-4 persian-text"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-3">
          {['۱','۲','۳','۴','۵','۶','۷','۸','۹'].map((d, i) => (
            <motion.button
              key={d}
              onClick={() => handleDigit(String(i + 1))}
              disabled={busy}
              whileTap={{ scale: 0.88 }}
              className="h-14 rounded-xl bg-gray-100 hover:bg-amber-50 text-gray-800 font-bold text-xl transition-colors touch-target disabled:opacity-50"
              aria-label={`عدد ${d}`}
            >
              {d}
            </motion.button>
          ))}
          <div /> {/* empty cell */}
          <motion.button
            onClick={() => handleDigit('0')}
            disabled={busy}
            whileTap={{ scale: 0.88 }}
            className="h-14 rounded-xl bg-gray-100 hover:bg-amber-50 text-gray-800 font-bold text-xl transition-colors touch-target disabled:opacity-50"
            aria-label="عدد صفر"
          >
            ۰
          </motion.button>
          <motion.button
            onClick={handleDelete}
            disabled={busy}
            whileTap={{ scale: 0.88 }}
            className="h-14 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 font-bold text-lg transition-colors touch-target disabled:opacity-50"
            aria-label="پاک کردن آخرین رقم"
          >
            ⌫
          </motion.button>
        </div>

        {state === 'enter_pin' && (
          <button
            onClick={() => { setState('reset'); setPin(''); setError(null) }}
            className="mt-5 text-xs text-gray-400 hover:text-amber-600 transition-colors"
          >
            پین را فراموش کردید؟
          </button>
        )}
      </motion.div>
    </div>
  )
}
