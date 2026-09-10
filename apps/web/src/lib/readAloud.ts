'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from './auth'

/* ── Recording a child's voice ───────────────────────────────────────────────
 *
 * The first thing in this app that captures audio. `lib/recognition.ts` is not
 * this: it uses the Web Speech API, which returns a transcript and keeps no
 * audio. Here the audio itself is the artifact, which is why this file is
 * careful about three things the rest of the client isn't:
 *
 *  - The stream is stopped on every exit path. A live mic indicator left on
 *    after the child walks away is the worst possible bug in this feature.
 *  - Recording stops itself at MAX_MS. Nothing about a five-year-old guarantees
 *    they will press stop.
 *  - The blob is never uploaded until the parent has consented and the child
 *    has pressed send. It lives in memory and is dropped on unmount.
 */

/** Matches the backend's 8 MB ceiling with room to spare at typical bitrates. */
export const MAX_MS = 180_000

/* Chrome and Firefox produce webm/opus; Safari produces mp4/aac. Both are
 * accepted server-side, so ask for the best available rather than forcing one
 * and getting an empty blob on the browser that doesn't support it. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}

export type RecorderState = 'idle' | 'asking' | 'recording' | 'done' | 'denied' | 'unsupported'

export interface Recording {
  blob: Blob
  url: string
  durationMs: number
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedMs, setElapsed] = useState(0)
  /** 0..1, smoothed. Drives the visual proof that the mic is hearing them —
   *  a five-year-old cannot debug silence, so the UI has to show sound. */
  const [level, setLevel] = useState(0)
  const [recording, setRecording] = useState<Recording | null>(null)

  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAt = useRef(0)
  const chunks = useRef<Blob[]>([])

  const teardown = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    recRef.current = null
    setLevel(0)
  }, [])

  // Unmount is an exit path too: navigating away mid-recording must release
  // the mic and revoke the object URL.
  useEffect(() => () => {
    teardown()
    setRecording(prev => { if (prev) URL.revokeObjectURL(prev.url); return null })
  }, [teardown])

  const stop = useCallback(() => {
    if (recRef.current?.state === 'recording') recRef.current.stop()
  }, [])

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia
        || typeof MediaRecorder === 'undefined') {
      setState('unsupported'); return
    }
    setState('asking')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch {
      // Every failure here is the same to the child: the app can't hear them.
      setState('denied'); return
    }
    streamRef.current = stream

    // Level meter. Separate from MediaRecorder on purpose — reading amplitude
    // off the recorded chunks would only update every timeslice.
    try {
      const ctx = new AudioContext()
      ctxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        let peak = 0
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128)
        // Ease toward the peak so the meter breathes instead of strobing.
        setLevel(prev => prev + (Math.min(1, peak * 2.2) - prev) * 0.28)
        setElapsed(Date.now() - startedAt.current)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      /* No meter is survivable; no recording is not. Carry on. */
    }

    const mimeType = pickMimeType()
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recRef.current = rec
    chunks.current = []
    rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
    rec.onstop = () => {
      const durationMs = Date.now() - startedAt.current
      const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
      teardown()
      // A blob under a few hundred bytes is a mic that produced nothing, not a
      // short reading — treat it as a failure rather than uploading silence.
      if (blob.size < 512) { setState('denied'); return }
      setRecording({ blob, url: URL.createObjectURL(blob), durationMs })
      setState('done')
    }

    startedAt.current = Date.now()
    setElapsed(0)
    rec.start(250)
    setState('recording')
    window.setTimeout(() => { if (recRef.current?.state === 'recording') recRef.current.stop() }, MAX_MS)
  }, [teardown])

  const reset = useCallback(() => {
    setRecording(prev => { if (prev) URL.revokeObjectURL(prev.url); return null })
    setElapsed(0)
    setState('idle')
  }, [])

  return { state, elapsedMs, level, recording, start, stop, reset }
}

/* Upload. Not on the shared api client, which only speaks JSON and is also
 * used by mobile — this is one multipart POST and doesn't justify widening
 * that interface. */
export async function uploadRecording(
  rec: Recording, childId: string, storyId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData()
  const ext = rec.blob.type.includes('mp4') ? 'm4a' : rec.blob.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('audio', rec.blob, `read-aloud.${ext}`)
  form.append('child_id', childId)
  if (storyId) form.append('story_id', storyId)
  form.append('duration_ms', String(Math.round(rec.durationMs)))

  const token = getToken()
  try {
    const res = await fetch('/api/read-aloud', {
      method: 'POST',
      // No Content-Type: the browser must set the multipart boundary itself.
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: json?.error ?? 'صدا ذخیره نشد' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'اینترنت قطع است. دوباره تلاش کن' }
  }
}

/** Persian-Indic mm:ss. Latin digits force a bidi run change mid-clause. */
export function faDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const s = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  return s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}
