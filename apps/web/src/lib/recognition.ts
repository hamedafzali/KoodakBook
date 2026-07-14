// Persian speech recognition via the Web Speech API (Chrome/Edge/Safari).
// Used by the speaking-practice module to check a child's pronunciation.

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

export function recognitionSupported(): boolean {
  return getRecognitionCtor() !== null
}

/** Normalize Persian text for comparison (strip diacritics, ZWNJ, spaces). */
export function normalizeFa(s: string): string {
  return s
    .replace(/[ً-ْٰ]/g, '') // harakat
    .replace(/‌/g, '')                 // ZWNJ
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')  // Arabic → Persian forms
    .replace(/\s+/g, '')
    .trim()
}

export interface ListenResult {
  transcript: string
  matched: boolean
}

/** Free dictation: listen once and return whatever Persian was heard
 *  (conversation mode — no target to match). Empty string = heard nothing. */
export function dictateOnce(timeoutMs = 7000): Promise<string> {
  return listenOnce('', timeoutMs).then(r => r.transcript.trim())
}

/**
 * Listen once and compare against the target word.
 * Resolves with the transcript and whether it matches.
 */
export function listenOnce(target: string, timeoutMs = 6000): Promise<ListenResult> {
  return new Promise((resolve, reject) => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) { reject(new Error('unsupported')); return }

    const rec = new Ctor()
    rec.lang = 'fa-IR'
    rec.interimResults = false
    rec.maxAlternatives = 3
    rec.continuous = false

    let settled = false
    const timer = setTimeout(() => { if (!settled) { settled = true; try { rec.stop() } catch {} ; resolve({ transcript: '', matched: false }) } }, timeoutMs)

    rec.onresult = (e) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const transcript = e.results[0][0].transcript ?? ''
      const matched = normalizeFa(transcript).includes(normalizeFa(target)) ||
                      normalizeFa(target).includes(normalizeFa(transcript))
      resolve({ transcript, matched })
    }
    rec.onerror = (e) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(e.error || 'error'))
    }
    rec.onend = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ transcript: '', matched: false })
    }

    try { rec.start() } catch { clearTimeout(timer); reject(new Error('start-failed')) }
  })
}
