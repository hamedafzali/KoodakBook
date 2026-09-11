'use client'
import { MotionConfig } from 'framer-motion'

/* Root-wide reduced-motion switch. `reducedMotion="user"` makes every
 * framer-motion animation in the app (BottomNav tap springs, card entrances,
 * MarpeleBoard's emoji Confetti, RewardPopup's pop-in, etc.) honor the OS
 * prefers-reduced-motion setting automatically — values jump straight to
 * their end state instead of tweening. Individual components that already
 * call useReducedMotion() directly (SceneBackdrop, phonics MergeStage) are
 * unaffected; this only fills the gap for the rest. Canvas-confetti bursts
 * aren't framer-motion and need their own guard — see lib/confetti.ts. */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
