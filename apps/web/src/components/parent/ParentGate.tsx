'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PIN_KEY = 'koodakbook_parent_pin'
const PIN_LENGTH = 4

interface Props {
  children: React.ReactNode
}

export default function ParentGate({ children }: Props) {
  const [state, setState] = useState<'loading' | 'set_pin' | 'enter_pin' | 'unlocked'>('loading')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'first' | 'confirm'>('first')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem(PIN_KEY)
    if (stored) {
      setState('enter_pin')
    } else {
      setState('set_pin')
    }
  }, [])

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  function handleDigit(d: string) {
    setError(null)
    if (state === 'enter_pin') {
      const next = pin + d
      if (next.length <= PIN_LENGTH) {
        setPin(next)
        if (next.length === PIN_LENGTH) checkPin(next)
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
    setError(null)
    if (state === 'enter_pin') setPin(p => p.slice(0, -1))
    else if (step === 'first') setPin(p => p.slice(0, -1))
    else setConfirmPin(p => p.slice(0, -1))
  }

  function checkPin(entered: string) {
    const stored = localStorage.getItem(PIN_KEY)
    if (entered === stored) {
      setState('unlocked')
    } else {
      triggerShake()
      setError('پین اشتباه است. دوباره تلاش کنید')
      setTimeout(() => setPin(''), 500)
    }
  }

  function savePin(p: string, c: string) {
    if (p !== c) {
      triggerShake()
      setError('پین‌ها مطابقت ندارند. دوباره امتحان کنید')
      setStep('first')
      setPin('')
      setConfirmPin('')
      return
    }
    localStorage.setItem(PIN_KEY, p)
    setState('unlocked')
  }

  function resetPin() {
    localStorage.removeItem(PIN_KEY)
    setPin('')
    setConfirmPin('')
    setStep('first')
    setError(null)
    setState('set_pin')
  }

  const currentPin = state === 'enter_pin' ? pin : step === 'first' ? pin : confirmPin

  if (state === 'loading') return null
  if (state === 'unlocked') return <>{children}</>

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
              whileTap={{ scale: 0.88 }}
              className="h-14 rounded-xl bg-gray-100 hover:bg-amber-50 text-gray-800 font-bold text-xl transition-colors touch-target"
              aria-label={`عدد ${d}`}
            >
              {d}
            </motion.button>
          ))}
          <div /> {/* empty cell */}
          <motion.button
            onClick={() => handleDigit('0')}
            whileTap={{ scale: 0.88 }}
            className="h-14 rounded-xl bg-gray-100 hover:bg-amber-50 text-gray-800 font-bold text-xl transition-colors touch-target"
            aria-label="عدد صفر"
          >
            ۰
          </motion.button>
          <motion.button
            onClick={handleDelete}
            whileTap={{ scale: 0.88 }}
            className="h-14 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 font-bold text-lg transition-colors touch-target"
            aria-label="پاک کردن آخرین رقم"
          >
            ⌫
          </motion.button>
        </div>

        {state === 'enter_pin' && (
          <button
            onClick={resetPin}
            className="mt-5 text-xs text-gray-400 hover:text-amber-600 transition-colors"
          >
            پین را فراموش کردید؟ ریست کنید
          </button>
        )}
      </motion.div>
    </div>
  )
}
