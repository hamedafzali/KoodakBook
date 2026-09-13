'use client'
// Simorgh — the app mascot — renders from the standalone
// `pixel-wizards-charachters` library, the same npm package that powers every
// character. One source of truth for the art; this keeps the exact
// {size, mood, className} API every call site already uses. Idle float /
// excited bounce come from the library rig itself.
import { CharacterActor } from 'pixel-wizards-charachters/react'
import { useCharacterEmotions } from '@/lib/characterEmotions'
import { MOOD_TO_EMOTION, MOOD_INTENSITY, type CharacterMood } from './mood'

interface Props {
  size?: number
  /** Any mood in `mood.ts` — the rig's full twelve, not the three this
   *  component used to expose. `idle` remains the alias for `neutral`, so
   *  every existing call site is unchanged. */
  mood?: CharacterMood
  className?: string
}

export default function Mascot({ size = 120, mood = 'idle', className }: Props) {
  const emotion = MOOD_TO_EMOTION[mood] ?? MOOD_TO_EMOTION.idle
  const intensity = MOOD_INTENSITY[mood] ?? MOOD_INTENSITY.idle
  const emotions = useCharacterEmotions('simorgh')
  return (
    <CharacterActor
      character="simorgh"
      size={size}
      className={className}
      style={{ width: size, height: size }}
      frame={{ emotion, intensity }}
      emotions={emotions}
    />
  )
}
