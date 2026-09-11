import confetti, { type Options } from 'canvas-confetti'

/* canvas-confetti animates via its own rAF loop, not framer-motion, so
 * MotionProvider's reducedMotion="user" doesn't reach it. Route every
 * celebration burst through here instead of calling confetti() directly:
 * under prefers-reduced-motion it's skipped outright — success state (badge,
 * sound, screen transition) still happens, only the particle burst is
 * dropped, per DESIGN_CHARTER.md "Respect prefers-reduced-motion". */
export function celebrate(opts: Options) {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  confetti(opts)
}
