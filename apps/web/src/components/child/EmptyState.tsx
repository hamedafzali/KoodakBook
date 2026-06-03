'use client'
import { motion } from 'framer-motion'
import Mascot from './Mascot'

interface Props {
  message: string
  subMessage?: string
  action?: React.ReactNode
}

export default function EmptyState({ message, subMessage, action }: Props) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Mascot size={90} mood="idle" />
      </motion.div>
      <div>
        <p className="font-bold text-gray-700 text-lg persian-text">{message}</p>
        {subMessage && <p className="text-gray-400 text-sm mt-1 persian-text">{subMessage}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  )
}
