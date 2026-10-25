'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Mascot from './Mascot'
import { speakPersian } from '@/lib/speech'
import { Icon, type IconName } from '@/components/icons'
import { ClayButton, softClayVars } from './clay'

const SEEN_KEY = 'koodakbook_seen_tutorial'

export function hasSeenTutorial(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(SEEN_KEY) === '1'
}

interface Step {
  /** Set only on the mascot step; every other step uses `icon`. */
  emoji: string | null
  icon: IconName | null
  title: string
  body: string
}

const STEPS: Step[] = [
  // Step 0 keeps its mascot (EMOJI-CONTENT — Simorgh is a character, and this
  // is the child's first meeting with him); the rest are wayfinding, so they
  // use the same icons the child will see in the nav a moment later.
  { emoji: '🦅', icon: null, title: 'سلام! من سیمرغم', body: 'با هم فارسی یاد می‌گیریم. آماده‌ای؟' },
  { emoji: null, icon: 'lessons' as IconName, title: 'درس‌ها', body: 'روی کارت‌ها ضربه بزن تا کلمه‌ها را بشنوی و بازی کنی.' },
  { emoji: null, icon: 'stories' as IconName, title: 'داستان‌ها', body: 'داستان‌های قشنگ بخوان و گوش کن.' },
  { emoji: null, icon: 'rewards' as IconName, title: 'جایزه‌ها', body: 'هر چه بیشتر تمرین کنی، جایزه‌های بیشتری می‌گیری!' },
]

interface Props {
  childName?: string
  onClose: () => void
}

export default function Tutorial({ childName, onClose }: Props) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function finish() {
    localStorage.setItem(SEEN_KEY, '1')
    onClose()
  }

  function next() {
    if (isLast) { finish(); return }
    setStep(s => s + 1)
  }

  /* A modal dialog has to take focus when it opens and let Escape out — it
   * did neither, so a keyboard user stayed behind the overlay on the home
   * screen. Escape counts as «رد کردن» (same as the skip button). */
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    // Hand focus back to wherever it was when the dialog closes.
    const prev = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => { prev?.focus?.() }
  }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { finish(); return }
      // aria-modal only tells a screen reader; Tab itself walked straight out
      // onto the home screen behind the overlay. Keep it inside the panel.
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !panel.contains(active) || active === panel
      if (e.shiftKey && (outside || active === first)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (outside || active === last)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  return (
    <motion.div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="راهنمای شروع"
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        /* The panel is a focus landing spot, not a control — no ring on it
           (inline, because the unlayered global :focus-visible rule would
           beat a Tailwind outline utility). */
        style={{ ...softClayVars('brand'), outline: 'none' }}
        className="clay-static p-7 max-w-xs w-full text-center shadow-2xl"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      >
        <motion.div
          className="flex justify-center mb-3"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Mascot size={96} mood="happy" />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
          >
            <div className="text-4xl mb-2 flex justify-center text-amber-500" aria-hidden="true">
              {current.emoji ?? <Icon name={current.icon!} size={40} strokeWidth={1.8} />}
            </div>
            <h2 className="font-display text-xl font-black text-text-primary mb-1">
              {step === 0 && childName ? `سلام ${childName}!` : current.title}
            </h2>
            <p className="text-text-secondary persian-text mb-5">{current.body}</p>
          </motion.div>
        </AnimatePresence>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-brand-bright' : 'bg-border'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          <motion.button
            onClick={finish}
            className="flex-1 py-3 rounded-md text-text-secondary font-medium text-sm min-h-[56px]"
            whileTap={{ scale: 0.96 }}
          >
            رد کردن
          </motion.button>
          <ClayButton ramp="brand" size="lg" className="flex-[2]" onClick={() => { speakPersian(current.body); next() }}>
            {isLast ? 'بزن بریم!' : 'بعدی ←'}
          </ClayButton>
        </div>
      </motion.div>
    </motion.div>
  )
}
