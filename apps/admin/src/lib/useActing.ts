'use client'
/* Plays a Performance (from @koodakbook/shared) on a CharacterAvatar: drives
 * `mouth` (0..1) and `mood` over a rAF clock. Pass an audio_url and the track
 * scales to the clip's real duration, so the lip-sync matches the voice.
 * The engine (text → track) is shared; only the playback clock lives here. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { buildPerformance, type ActingMood } from '@koodakbook/shared'

export function useActing() {
  const [mouth, setMouth] = useState(0)
  const [mood, setMood] = useState<ActingMood>('idle')
  const [playing, setPlaying] = useState(false)
  const raf = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current)
    raf.current = null
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlaying(false); setMouth(0)
  }, [])

  useEffect(() => stop, [stop])

  const play = useCallback(async (text: string, emotion?: string | null, audioUrl?: string | null) => {
    stop()
    if (!text.trim()) return

    // If the line has a clip, read its duration so the viseme track locks to it.
    let totalMs: number | undefined
    let audio: HTMLAudioElement | null = null
    if (audioUrl) {
      audio = new Audio(audioUrl)
      audio.preload = 'auto'
      await new Promise<void>((resolve) => {
        let done = false
        const finish = () => { if (!done) { done = true; resolve() } }
        audio!.onloadedmetadata = finish
        audio!.onerror = () => { audio = null; finish() }
        setTimeout(finish, 1500) // never hang on a slow/blocked clip
      })
      if (audio && isFinite(audio.duration) && audio.duration > 0) totalMs = audio.duration * 1000
    }

    const perf = buildPerformance(text, emotion, { totalMs })
    audioRef.current = audio
    setPlaying(true)
    setMood(perf.emotion)

    const start = performance.now()
    let i = 0, target = 0, cur = 0
    if (audio) audio.play().catch(() => {})

    const tick = (now: number) => {
      const el = now - start
      while (i < perf.frames.length && perf.frames[i].t <= el) {
        const f = perf.frames[i]
        if (f.mouth != null) target = f.mouth
        if (f.mood) setMood(f.mood)
        i++
      }
      cur += (target - cur) * 0.4            // smooth the flap between visemes
      setMouth(cur)
      if (el >= perf.duration) {
        setMouth(0); setPlaying(false); audioRef.current = null; raf.current = null
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [stop])

  return { mouth, mood, playing, play, stop }
}
