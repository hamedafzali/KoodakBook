'use client'
import { motion } from 'framer-motion'
import Mascot from './Mascot'

interface Props {
  message?: string
}

export default function LoadingScreen({ message = 'در حال بارگذاری...' }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 child-bg">
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Mascot size={100} mood="idle" />
      </motion.div>
      <motion.p
        className="text-gray-500 font-medium persian-text text-base"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {message}
      </motion.p>
    </div>
  )
}
