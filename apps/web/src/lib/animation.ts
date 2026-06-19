/* Runtime animation reader (Phase 0).
 *
 * Turns a content row's `animation_template` + `animation_params` into the
 * framer-motion props the tile renders with — the CSS/framer "engine" fallback.
 * The Rive/Lottie engines (Phases 1–3) slot in behind the same `template`
 * switch later; nothing downstream changes when they do.
 *
 * Honours the hard rules: a non-animated template (`none`, e.g. question words)
 * yields no motion (static card + audio only), and any per-row `duration_ms` is
 * clamped to the age cap. */
import type { AnimationParams, AnimationTemplate } from '@koodakbook/shared'
import { TEMPLATE_REGISTRY, durationCapMsForAge } from '@koodakbook/shared'

export interface TapMotion {
  animated: boolean
  scale: number
  transition: Record<string, unknown>
}

const SPRING = { type: 'spring', stiffness: 400, damping: 17 } as const

export function tapMotionFor(
  template?: AnimationTemplate | null,
  params?: AnimationParams | null,
  ageMin?: number | null,
): TapMotion {
  // No template yet → the historical default (a gentle squash on tap).
  if (!template) return { animated: true, scale: 0.88, transition: SPRING }

  const spec = TEMPLATE_REGISTRY[template]
  if (!spec || !spec.animated) return { animated: false, scale: 1, transition: SPRING }

  const p = (params ?? {}) as Record<string, unknown>
  const scale = typeof p.squash === 'number' ? p.squash : 0.88
  const durMs =
    typeof p.duration_ms === 'number'
      ? Math.min(p.duration_ms, durationCapMsForAge(ageMin))
      : undefined
  return { animated: true, scale, transition: durMs ? { duration: durMs / 1000 } : SPRING }
}
