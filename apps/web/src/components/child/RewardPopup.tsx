'use client'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { Badge } from '@koodakbook/shared'
import Mascot from './Mascot'
import { playComplete } from '@/lib/sounds'

interface Props {
  badge: Badge
  onClose: () => void
}

export default function RewardPopup({ badge, onClose }: Props) {
  const closed = useRef(false)

  useEffect(() => {
    playComplete()

    // burst confetti
    const burst = () => {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.55 }, colors: ['#f97316','#eab308','#22c55e','#3b82f6','#ec4899'] })
      confetti({ particleCount: 40, spread: 120, origin: { y: 0.55 }, startVelocity: 20, colors: ['#fbbf24','#fb923c','#f43f5e'] })
    }
    burst()
    const t2 = setTimeout(burst, 600)
    const t3 = setTimeout(() => { if (!closed.current) onClose() }, 5000)

    return () => { clearTimeout(t2); clearTimeout(t3) }
  }, [onClose])

  function handleClose() {
    closed.current = true
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          className="bg-white rounded-[2rem] p-8 max-w-xs w-full text-center shadow-2xl"
          initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -8, 8, -5, 5, 0], scale: [1, 1.15, 1.05, 1.1, 1] }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex justify-center mb-2"
          >
            <Mascot size={100} mood="excited" />
          </motion.div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.3 }}
            className="text-6xl mb-3"
          >
            🏆
          </motion.div>

          <motion.h2
            className="text-2xl font-bold text-amber-600 mb-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {badge.title}
          </motion.h2>

          <motion.p
            className="text-gray-500 text-sm mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {badge.description}
          </motion.p>

          <motion.button
            onClick={handleClose}
            className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold py-3 px-8 rounded-2xl text-lg shadow-md w-full"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            ممنون! 🎉
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
