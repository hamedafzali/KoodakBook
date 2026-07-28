'use client'
// MIRROR of apps/web/src/components/child/CharacterAvatar.tsx — keep in sync.
// Thin adapter over the standalone `pixel-wizards-charachters` library (npm-publishable,
// lives beside the repo). The art, rig, Persian-viseme lip-sync, gaze, brows,
// gestures and locomotion all live in that package; this keeps the exact
// call-site API the admin app already uses.
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CharacterActor } from 'pixel-wizards-charachters/react'
import { CHARACTERS } from 'pixel-wizards-charachters'
import type { ActorRig, EmotionName } from 'pixel-wizards-charachters'
import Mascot from './Mascot'

export type CharacterMood = 'idle' | 'happy' | 'excited' | 'encouraging' | 'thinking'

interface Props {
  slug: string
  size?: number
  mood?: CharacterMood
  talking?: boolean
  /** Driven viseme openness 0..1 from a performance track (useActing). */
  mouth?: number
  className?: string
}

const MOOD_TO_EMOTION: Record<CharacterMood, EmotionName> = {
  idle: 'neutral',
  happy: 'happy',
  excited: 'excited',
  encouraging: 'encouraging',
  thinking: 'thinking',
}

const MOOD_INTENSITY: Record<CharacterMood, number> = {
  idle: 0.6, happy: 0.85, excited: 1, encouraging: 0.85, thinking: 0.7,
}

/** A library character driven imperatively through the rig, so lip-sync never
 *  triggers a React re-render. */
function LibraryAvatar({ slug, size = 120, mood = 'idle', talking, mouth, className }: Props) {
  const rig = useRef<ActorRig | null>(null)
  const emotion = MOOD_TO_EMOTION[mood]
  const intensity = MOOD_INTENSITY[mood]

  useEffect(() => {
    rig.current?.apply({ emotion, intensity })
  }, [slug, emotion, intensity])

  useEffect(() => {
    const r = rig.current
    if (!r) return
    if (mouth != null) {
      r.apply({ viseme: 'rest', mouthOpen: Math.max(0, Math.min(1, mouth)) })
      return
    }
    if (!talking) {
      r.apply({ viseme: 'rest', mouthOpen: 0 })
      return
    }
    const t0 = Date.now()
    const id = setInterval(() => {
      const p = ((Date.now() - t0) % 320) / 320
      r.apply({ viseme: 'rest', mouthOpen: 0.3 + 0.35 * (0.5 - 0.5 * Math.cos(p * 2 * Math.PI)) })
    }, 55)
    return () => clearInterval(id)
  }, [slug, mouth, talking])

  return (
    <CharacterActor
      character={slug}
      size={size}
      className={className}
      style={{ width: size, height: size }}
      rigRef={rig}
    />
  )
}

/** Simorgh / unknown slugs keep the mascot artwork with a light acting bob. */
function MascotFallback({ size = 120, mood = 'idle', talking, className }: Props) {
  const anim =
    talking ? { y: [0, -3, 0], transition: { duration: 0.34, repeat: Infinity, ease: 'easeInOut' as const } }
    : mood === 'excited' ? { rotate: [-4, 4, -4, 4, 0], scale: [1, 1.08, 1], transition: { duration: 0.5 } }
    : mood === 'happy' ? { y: [0, -10, 0], transition: { duration: 0.6 } }
    : mood === 'thinking' ? { rotate: [-2.5, 2.5, -2.5], transition: { duration: 1.9, repeat: Infinity, ease: 'easeInOut' as const } }
    : { y: [0, -6, 0], transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const } }
  const mascotMood = mood === 'excited' ? 'excited' : mood === 'happy' ? 'happy' : 'idle'
  return (
    <motion.div className={className} style={{ width: size, height: size, position: 'relative' }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      animate={anim as any}>
      <Mascot size={size} mood={talking ? 'idle' : mascotMood} />
    </motion.div>
  )
}

export default function CharacterAvatar(props: Props) {
  if (props.slug in CHARACTERS) return <LibraryAvatar {...props} />
  return <MascotFallback {...props} />
}
