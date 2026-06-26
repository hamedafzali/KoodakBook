'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Mascot from './Mascot'
import { speakPersian } from '@/lib/speech'

const SEEN_KEY = 'koodakbook_seen_tutorial'

export function hasSeenTutorial(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(SEEN_KEY) === '1'
}

interface Step {
  emoji: string
  title: string
  body: string
}

const STEPS: Step[] = [
  { emoji: '🦅', title: 'سلام! من سیمرغم', body: 'با هم فارسی یاد می‌گیریم. آماده‌ای؟' },
  { emoji: '📚', title: 'درس‌ها', body: 'روی کارت‌ها ضربه بزن تا کلمه‌ها را بشنوی و بازی کنی.' },
  { emoji: '📖', title: 'داستان‌ها', body: 'داستان‌های قشنگ بخوان و گوش کن.' },
  { emoji: '🏆', title: 'جایزه‌ها', body: 'هر چه بیشتر تمرین کنی، جایزه‌های بیشتری می‌گیری!' },
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
        className="bg-white rounded-[2rem] p-7 max-w-xs w-full text-center shadow-2xl"
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
            <div className="text-4xl mb-2" aria-hidden="true">{current.emoji}</div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              {step === 0 && childName ? `سلام ${childName}! 👋` : current.title}
            </h2>
            <p className="text-gray-500 persian-text mb-5">{current.body}</p>
          </motion.div>
        </AnimatePresence>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-amber-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          <motion.button
            onClick={finish}
            className="flex-1 py-3 rounded-md text-gray-400 font-medium text-sm min-h-[48px]"
            whileTap={{ scale: 0.96 }}
          >
            رد کردن
          </motion.button>
          <motion.button
            onClick={() => { speakPersian(current.body); next() }}
            className="flex-[2] py-3 rounded-md bg-brand-gradient text-white font-bold shadow-md min-h-[48px]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
          >
            {isLast ? 'بزن بریم! 🚀' : 'بعدی ←'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
