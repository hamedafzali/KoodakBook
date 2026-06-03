// Persian text-to-speech via the Web Speech API.
// Provides spoken audio for words, letters and story pages without
// pre-recorded files. If a recorded audio URL exists, callers should
// prefer it; this is the universal fallback so nothing is ever silent.

let voicesLoaded = false
let cachedFaVoice: SpeechSynthesisVoice | null = null

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis ?? null
}

/** Find the best available Persian voice, falling back to Arabic, then default. */
function pickPersianVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (cachedFaVoice) return cachedFaVoice
  const voices = synth.getVoices()
  if (voices.length === 0) return null

  const fa =
    voices.find(v => v.lang === 'fa-IR') ??
    voices.find(v => v.lang?.toLowerCase().startsWith('fa')) ??
    voices.find(v => v.lang?.toLowerCase().startsWith('ar')) ?? // Arabic shares most phonemes/script
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

  try {
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    const voice = pickPersianVoice(synth)
    if (voice) utter.voice = voice
    utter.lang = voice?.lang ?? 'fa-IR'
    // Slower, higher pitch is clearer and friendlier for children
    utter.rate = opts?.rate ?? 0.85
    utter.pitch = opts?.pitch ?? 1.1
    synth.speak(utter)
    return true
  } catch {
    return false
  }
}

/** True if the browser can speak at all (used to decide quiz audio modes). */
export function canSpeak(): boolean {
  return getSynth() !== null
}

export function stopSpeaking() {
  getSynth()?.cancel()
}
