'use client'
// MIRROR of apps/web/src/components/child/Mascot.tsx — keep in sync.
// Simorgh — the app mascot — now renders from the standalone
// `pixel-wizards-charachters` library, the same npm package that powers every
// character. One source of truth for the art; keeps the exact
// {size, mood, className} API every call site already uses.
import { CharacterActor } from 'pixel-wizards-charachters/react'
import type { EmotionName } from 'pixel-wizards-charachters'

interface Props {
  size?: number
  mood?: 'happy' | 'excited' | 'idle'
  className?: string
}

const MOOD: Record<NonNullable<Props['mood']>, [EmotionName, number]> = {
  idle: ['neutral', 0.6],
  happy: ['happy', 0.85],
  excited: ['excited', 1],
}

export default function Mascot({ size = 120, mood = 'idle', className }: Props) {
  const [emotion, intensity] = MOOD[mood] ?? MOOD.idle
  return (
    <CharacterActor
      character="simorgh"
      size={size}
      className={className}
      style={{ width: size, height: size }}
      frame={{ emotion, intensity }}
    />
  )
}
