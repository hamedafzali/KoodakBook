'use client'
import { useEffect, useState } from 'react'
import { onSpeaking } from './speech'

/** True while a character voice (clip or browser TTS) is actually playing —
 *  drives talking animation so mouths move exactly when sound does. */
export function useSpeaking(): boolean {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => onSpeaking(setSpeaking), [])
  return speaking
}
