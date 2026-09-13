'use client'
import { motion } from 'framer-motion'
import CharacterAvatar from './CharacterAvatar'

interface Props {
  message?: string
}

/* چرخی — the cast's vehicle character — fronts every wait in the app, not
 * Simorgh: loading/progress is چرخی's room (cast-assignment pass). Bobs on
 * its own suspension via the rig's real `roll` gait (PixelWizardsCharachters
 * 1.1.0) — a body-mechanic the rig itself now drives frame-by-frame, so the
 * borrowed `motion.div` float this used while that gait didn't exist yet is
 * gone; the wrapper is a plain positioning div now. */
export default function LoadingScreen({ message = 'در حال بارگذاری...' }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 child-bg">
      <div>
        <CharacterAvatar slug="charkhi" size={100} mood="thinking" locomotion="roll" />
      </div>
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
