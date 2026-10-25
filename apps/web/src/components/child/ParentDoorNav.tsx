'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Icon } from '@/components/icons'

/**
 * The door from child mode back to the parent area, as a labelled nav item.
 * Discoverable (always visible in the nav, with a label) but child-resistant:
 * it requires a ~0.7s press-and-hold (a tap does nothing), with a visible fill
 * so it's clear you hold it. The PIN gate is still the real lock behind it.
 */
const HOLD_MS = 700

/* `card`: the same door drawn as the pill inside Home's quiet parent card
 * (2026-09-28 visual-fidelity pass). Same hold, same PIN gate, same name —
 * a second way to FIND the door, never a second, tap-only way through it. */
export default function ParentDoorNav({ variant = 'bar' }: { variant?: 'bar' | 'rail' | 'card' }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [holding, setHolding] = useState(false)
  // A hold still running when this nav unmounts (the child tapped another
  // tab mid-hold) must not open the parent area from the next screen.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function start() {
    setHolding(true)
    timer.current = setTimeout(() => { setHolding(false); router.push('/parent/dashboard') }, HOLD_MS)
  }
  function cancel() {
    setHolding(false)
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }

  const isRail = variant === 'rail'
  const isCard = variant === 'card'
  const frame = isCard
    ? 'flex-row min-h-[56px] px-4 rounded-2xl gap-2 bg-white/80 shadow-card'
    : isRail
    ? 'flex-col w-16 h-16 rounded-2xl gap-1'
    : 'flex-col min-w-[60px] min-h-[56px] rounded-xl gap-0.5'

  return (
    <button
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={e => e.preventDefault()}
      /* Keyboard parity: the hold was pointer-only, so Enter/Space did
         nothing and a keyboard-only parent had no way out of child mode.
         Holding the key is the same deliberate gesture as holding a finger
         (auto-repeat is ignored so it can't restart the timer). */
      onKeyDown={e => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (!e.repeat && !timer.current) start()
      }}
      onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') cancel() }}
      onBlur={cancel}
      aria-label="ورود والدین — نگه دارید"
      title="برای ورود والدین نگه دارید"
      className={`relative overflow-hidden flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors select-none touch-target-child ${frame}`}
    >
      {/* Hold-progress fill (RTL: grows from the right) */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 bg-amber-200/70 origin-right"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: holding ? 1 : 0 }}
        transition={{ duration: holding ? HOLD_MS / 1000 : 0.15, ease: 'linear' }}
      />
      <span className="relative leading-none"><Icon name="locked" size={isCard ? 'md' : 'lg'} /></span>
      {isCard
        ? <span className="relative leading-tight text-start">
            <span className="block font-bold text-sm text-text-primary">ورود والدین</span>
            <span className="block text-xs">نگه دار تا باز شه</span>
          </span>
        : <span className={`relative leading-none font-medium ${isRail ? 'text-[11px]' : 'text-xs'}`}>والدین</span>}
    </button>
  )
}
