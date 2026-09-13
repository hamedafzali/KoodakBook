'use client'
import { motion } from 'framer-motion'
import CharacterAvatar from './CharacterAvatar'

interface Props {
  message?: string
}

/* چرخی — the cast's vehicle character — fronts every wait in the app, not
 * Simorgh: loading/progress is چرخی's room (cast-assignment pass). The rig
 * has no drive/roll gait yet (locomotion.ts only has idle/walk/fly), so this
 * borrows the same bob Simorgh used rather than faking a roll — a real roll
 * locomotion is a PixelWizardsCharachters library change, tracked separately,
 * not something to improvise here. */
export default function LoadingScreen({ message = 'در حال بارگذاری...' }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 child-bg">
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <CharacterAvatar slug="charkhi" size={100} mood="thinking" />
      </motion.div>
      <motion.p
        className="text-text-secondary font-medium persian-text text-base"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {message}
      </motion.p>
    </div>
  )
}
