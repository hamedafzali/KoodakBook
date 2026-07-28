'use client'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CharacterActor } from 'pixel-wizards-charachters/react'
import { CHARACTERS } from 'pixel-wizards-charachters'
import type { ActorRig, EmotionName } from 'pixel-wizards-charachters'
import Mascot from './Mascot'

/* Character visuals + ACTING.
 *
 * This is now a thin adapter over the `pixel-wizards-charachters` library:
 * the illustration-grade art, the animation rig, Persian-viseme lip-sync, gaze,
 * brows, gestures and locomotion all live in that package. This component keeps
 * the exact same call-site API the app already uses, so nothing else changes:
 *  - mood   : idle | happy | excited | encouraging | thinking  (→ library emotion)
 *  - talking: generic mouth flap while audio plays
 *  - mouth  : 0..1 viseme openness from a Performance track (useActing) — beats
 *             the generic `talking` loop when set.
 * Simorgh (and unknown slugs) fall back to the Mascot artwork. */

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

  // Emotion / body-motion pose.
  useEffect(() => {
    rig.current?.apply({ emotion, intensity })
  }, [slug, emotion, intensity])

  // Mouth: an explicit viseme track (mouth) wins; else a generic talking flap;
  // else the resting mouth for the emotion.
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
