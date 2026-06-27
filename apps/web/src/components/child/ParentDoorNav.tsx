'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

/**
 * The door from child mode back to the parent area, as a labelled nav item.
 * Discoverable (always visible in the nav, with a label) but child-resistant:
 * it requires a ~0.7s press-and-hold (a tap does nothing), with a visible fill
 * so it's clear you hold it. The PIN gate is still the real lock behind it.
 */
const HOLD_MS = 700

export default function ParentDoorNav({ variant = 'bar' }: { variant?: 'bar' | 'rail' }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [holding, setHolding] = useState(false)

  function start() {
    setHolding(true)
    timer.current = setTimeout(() => { setHolding(false); router.push('/parent/dashboard') }, HOLD_MS)
  }
  function cancel() {
    setHolding(false)
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }

  const isRail = variant === 'rail'
  const frame = isRail
    ? 'w-16 h-16 rounded-2xl gap-1'
    : 'min-w-[60px] min-h-[44px] rounded-xl gap-0.5'

  return (
    <button
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={e => e.preventDefault()}
      aria-label="ورود والدین — نگه دارید"
      title="برای ورود والدین نگه دارید"
      className={`relative overflow-hidden flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 transition-colors select-none touch-target ${frame}`}
    >
      {/* Hold-progress fill (RTL: grows from the right) */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 bg-amber-200/70 origin-right"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: holding ? 1 : 0 }}
        transition={{ duration: holding ? HOLD_MS / 1000 : 0.15, ease: 'linear' }}
      />
      <span className="relative text-2xl leading-none" aria-hidden="true">🔒</span>
      <span className={`relative leading-none font-medium ${isRail ? 'text-[11px]' : 'text-xs'}`}>والدین</span>
    </button>
  )
}
