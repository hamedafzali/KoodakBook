'use client'
import { useEffect, useRef } from 'react'
import { CharacterActor } from 'pixel-wizards-charachters/react'
import { CHARACTERS } from 'pixel-wizards-charachters'
import type { ActorRig, EmotionOverrides, VisemeName, Locomotion } from 'pixel-wizards-charachters'
import { useCharacterEmotions } from '@/lib/characterEmotions'
import { MOOD_TO_EMOTION, MOOD_INTENSITY, type CharacterMood } from './mood'

/* Character visuals + ACTING.
 *
 * A thin adapter over the `pixel-wizards-charachters` library: the
 * illustration-grade art, the animation rig, Persian-viseme lip-sync, gaze,
 * brows, gestures and locomotion all live in that npm package. EVERY character
 * — including سیمرغ (the mascot) — renders from the library, so nothing comes
 * from app-local art. Unknown slugs fall back to سیمرغ. This component keeps the
 * exact call-site API the app already uses, so nothing else changes:
 *  - mood   : any name in `mood.ts` — all twelve rig emotions (→ library emotion)
 *  - talking: generic mouth flap while audio plays
 *  - mouth  : 0..1 viseme openness from a Performance track (useActing) — beats
 *             the generic `talking` loop when set.
 *  - viseme : the actual mouth SHAPE for that beat (useActing again) — pairs
 *             with `mouth`; omitted, the shape stays 'rest' (today's flap). */

/* The vocabulary lives in mood.ts so Mascot and CharacterAvatar can't drift.
 * Re-exported because call sites already import the type from here. */
export type { CharacterMood }

interface Props {
  slug: string
  size?: number
  mood?: CharacterMood
  talking?: boolean
  /** Driven viseme openness 0..1 from a performance track (useActing). */
  mouth?: number
  /** The rig's real mouth shape for this beat (useActing) — pairs with
   *  `mouth`. Omitted, the shape stays 'rest' regardless of `mouth`. */
  viseme?: VisemeName
  /** per-emotion tuning saved in the DB (animation.emotions) */
  emotions?: EmotionOverrides
  /** Body locomotion (idle/walk/fly/roll). Omitted, the rig stays idle —
   *  most call sites never move the body, only the face. */
  locomotion?: Locomotion
  className?: string
}

export default function CharacterAvatar({ slug, size = 120, mood = 'idle', talking, mouth, viseme, emotions, locomotion, className }: Props) {
  // Every real character is in the library; unknown slugs fall back to سیمرغ so
  // the avatar still renders from the npm package rather than app-local art.
  const character = slug in CHARACTERS ? slug : 'simorgh'
  const rig = useRef<ActorRig | null>(null)
  const emotion = MOOD_TO_EMOTION[mood]
  const intensity = MOOD_INTENSITY[mood]
  // Explicit overrides win; otherwise use whatever the admin saved for this slug.
  const savedEmotions = useCharacterEmotions(slug)
  const effEmotions = emotions ?? savedEmotions

  // Emotion / body-motion pose.
  useEffect(() => {
    rig.current?.apply({ emotion, intensity })
  }, [character, emotion, intensity])

  // Locomotion. Left untouched (rig default: idle) when the call site never
  // passes one, so every existing avatar keeps behaving exactly as before.
  useEffect(() => {
    if (locomotion == null) return
    rig.current?.apply({ locomotion })
  }, [character, locomotion])

  // Mouth: an explicit viseme track (mouth) wins; else a generic talking flap;
  // else the resting mouth for the emotion.
  useEffect(() => {
    const r = rig.current
    if (!r) return
    if (mouth != null) {
      r.apply({ viseme: viseme ?? 'rest', mouthOpen: Math.max(0, Math.min(1, mouth)) })
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
  }, [character, mouth, viseme, talking])

  return (
    <CharacterActor
      character={character}
      size={size}
      className={className}
      style={{ width: size, height: size }}
      emotions={effEmotions}
      rigRef={rig}
    />
  )
}
