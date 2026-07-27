'use client'
import { useEffect, useState } from 'react'
import { onActing, onSpeaking } from './speech'
import type { ActingMood } from '@koodakbook/shared'

/** Subscribes to the speech lib's acting broadcast: `mouth` (viseme openness
 *  0..1) and `mood` follow the actual words being spoken, and `speaking` is the
 *  on/off gate. Pass `mouth` to CharacterAvatar while speaking for lip-sync that
 *  matches the sentence; the same engine the admin performer uses. */
export function useActing(): { mouth: number; mood: ActingMood; speaking: boolean } {
  const [mouth, setMouth] = useState(0)
  const [mood, setMood] = useState<ActingMood>('idle')
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    const offActing = onActing((m, md) => { setMouth(m); setMood(md) })
    const offSpeaking = onSpeaking(setSpeaking)
    return () => { offActing(); offSpeaking() }
  }, [])
  return { mouth, mood, speaking }
}
