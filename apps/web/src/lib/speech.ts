// Persian text-to-speech via the Web Speech API.
// Provides spoken audio for words, letters and story pages without
// pre-recorded files. If a recorded audio URL exists, callers should
// prefer it; this is the universal fallback so nothing is ever silent.

import { mediaUrl } from './media'

let voicesLoaded = false
let cachedFaVoice: SpeechSynthesisVoice | null = null

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis ?? null
}

/**
 * Find a Persian voice on this device, or null. We deliberately do NOT fall
 * back to Arabic (or any other language): a Persian-learning app speaking
 * Arabic is worse than staying silent, and recorded clips cover the real
 * content anyway.
 */
function pickPersianVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (cachedFaVoice) return cachedFaVoice
  const voices = synth.getVoices()
  if (voices.length === 0) return null

  const fa =
    voices.find(v => v.lang === 'fa-IR') ??
    voices.find(v => v.lang?.toLowerCase().startsWith('fa')) ??
    null

  cachedFaVoice = fa
  return fa
}

/** Pre-warm the voice list (browsers load voices asynchronously). */
export function initSpeech() {
  const synth = getSynth()
  if (!synth || voicesLoaded) return
  const load = () => { pickPersianVoice(synth); voicesLoaded = true }
  load()
  if (synth.getVoices().length === 0) {
    synth.addEventListener('voiceschanged', load, { once: true })
  }
}

/**
 * Speak a Persian string. Cancels any in-flight utterance first so rapid
 * taps don't queue up. Returns true if speech was started.
 */
export function speakPersian(text: string, opts?: { rate?: number; pitch?: number }): boolean {
  const synth = getSynth()
  if (!synth || !text) return false

  const voice = pickPersianVoice(synth)
  // No Persian voice on this device → stay silent rather than mispronounce the
  // text with a foreign (e.g. English/Arabic) voice.
  if (!voice) return false

  try {
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.voice = voice
    utter.lang = voice.lang
    // Slower, higher pitch is clearer and friendlier for children
    utter.rate = opts?.rate ?? 0.85
    utter.pitch = opts?.pitch ?? 1.1
    synth.speak(utter)
    return true
  } catch {
    return false
  }
}

/**
 * Play a recorded clip if one exists, otherwise fall back to Persian TTS.
 * Use this everywhere audio is triggered so recorded Persian always wins over
 * (possibly absent) browser voices.
 */
export function speakOrPlay(audioUrl: string | null | undefined, text: string): void {
  const url = mediaUrl(audioUrl)
  if (url) {
    try {
      const audio = new Audio(url)
      audio.play().catch(() => { speakPersian(text) })
      return
    } catch { /* fall through to TTS */ }
  }
  speakPersian(text)
}

/** Like speakOrPlay, but tries several clip URLs in order (e.g. the premium
 * variant, then the free one) before falling back to browser TTS. */
export function speakOrPlayFirst(urls: (string | null | undefined)[], text: string): void {
  const list = urls.map(mediaUrl).filter((u): u is string => !!u)
  const tryAt = (i: number): void => {
    if (i >= list.length) { speakPersian(text); return }
    try {
      const audio = new Audio(list[i])
      audio.play().catch(() => tryAt(i + 1))
    } catch { tryAt(i + 1) }
  }
  tryAt(0)
}

/** True if the browser can speak at all (used to decide quiz audio modes). */
export function canSpeak(): boolean {
  return getSynth() !== null
}

export function stopSpeaking() {
  getSynth()?.cancel()
}
