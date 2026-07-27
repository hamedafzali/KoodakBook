// Persian text-to-speech via the Web Speech API.
// Provides spoken audio for words, letters and story pages without
// pre-recorded files. If a recorded audio URL exists, callers should
// prefer it; this is the universal fallback so nothing is ever silent.

import { mediaUrl } from './media'
import { buildPerformance, type ActingMood } from '@koodakbook/shared'

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
    // Browser TTS gives no duration up front, so run the track at its natural
    // cadence — still word-matched, just not length-locked like a recorded clip.
    utter.onstart = () => { setSpeaking(true); startPerformance(text) }
    utter.onend = () => { setSpeaking(false); stopPerformance() }
    utter.onerror = () => { setSpeaking(false); stopPerformance() }
    synth.speak(utter)
    return true
  } catch {
    return false
  }
}

// The clip currently playing, so a new play (or stopSpeaking) can cut it off —
// otherwise auto-playing sequential pages/cards would overlap.
let currentAudio: HTMLAudioElement | null = null

// ── Speaking broadcast: characters act (mouth, bob, gestures) while audio is
// actually playing. Listeners get true on start and false on end/cut. ──
type SpeakingListener = (speaking: boolean) => void
const speakingListeners = new Set<SpeakingListener>()
let speakingNow = false

function setSpeaking(v: boolean) {
  if (speakingNow === v) return
  speakingNow = v
  for (const fn of speakingListeners) { try { fn(v) } catch { /* listener's problem */ } }
}

/** Subscribe to "is a character voice playing right now". Returns unsubscribe. */
export function onSpeaking(fn: SpeakingListener): () => void {
  speakingListeners.add(fn)
  fn(speakingNow)
  return () => { speakingListeners.delete(fn) }
}

// ── Acting broadcast: sentence-matched lip-sync. Where `speaking` is just a
// boolean bob, this drives a viseme `mouth` (0..1) + `mood` built from the very
// words being spoken (@koodakbook/shared buildPerformance), scaled to the clip's
// real duration so the mouth tracks the voice. Any surface that plays a line via
// speakOrPlay gets it for free — it only has to pass `mouth` to CharacterAvatar.
type ActingListener = (mouth: number, mood: ActingMood) => void
const actingListeners = new Set<ActingListener>()
let actMouth = 0
let actMood: ActingMood = 'idle'
let actRaf: number | null = null

function emitActing() {
  for (const fn of actingListeners) { try { fn(actMouth, actMood) } catch { /* listener's problem */ } }
}

/** Subscribe to the acting track (mouth openness + body mood). Returns unsubscribe. */
export function onActing(fn: ActingListener): () => void {
  actingListeners.add(fn)
  fn(actMouth, actMood)
  return () => { actingListeners.delete(fn) }
}

function stopPerformance() {
  if (actRaf != null) { cancelAnimationFrame(actRaf); actRaf = null }
  if (actMouth !== 0) { actMouth = 0; emitActing() }
}

/** Run a viseme performance for `text` over a rAF clock, broadcasting each frame.
 *  `totalMs` (a clip's real duration) scales the track so lip-sync locks to it. */
function startPerformance(text: string, totalMs?: number) {
  stopPerformance()
  if (typeof window === 'undefined' || !text.trim()) return
  const perf = buildPerformance(text, null, totalMs ? { totalMs } : {})
  actMood = perf.emotion
  const start = performance.now()
  let i = 0, target = 0, cur = 0
  const tick = (now: number) => {
    const el = now - start
    while (i < perf.frames.length && perf.frames[i].t <= el) {
      const f = perf.frames[i]
      if (f.mouth != null) target = f.mouth
      if (f.mood) actMood = f.mood
      i++
    }
    cur += (target - cur) * 0.4            // smooth the flap between visemes
    actMouth = cur
    emitActing()
    if (el >= perf.duration) { actMouth = 0; emitActing(); actRaf = null; return }
    actRaf = requestAnimationFrame(tick)
  }
  actRaf = requestAnimationFrame(tick)
}

function stopAudio() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.currentTime = 0 } catch { /* ignore */ }
    currentAudio = null
  }
  setSpeaking(false)
  stopPerformance()
}

/**
 * Play a recorded clip if one exists, otherwise fall back to Persian TTS.
 * Use this everywhere audio is triggered so recorded Persian always wins over
 * (possibly absent) browser voices.
 */
export function speakOrPlay(audioUrl: string | null | undefined, text: string): void {
  speakOrPlayFirst([audioUrl], text)
}

/** Like speakOrPlay, but tries several clip URLs in order (e.g. the premium
 * variant, then the free one) before falling back to browser TTS. */
export function speakOrPlayFirst(urls: (string | null | undefined)[], text: string): void {
  stopAudio()
  getSynth()?.cancel()
  const list = urls.map(mediaUrl).filter((u): u is string => !!u)
  const tryAt = (i: number): void => {
    if (i >= list.length) { speakPersian(text); return }
    try {
      const audio = new Audio(list[i])
      currentAudio = audio
      audio.onplaying = () => {
        if (currentAudio !== audio) return
        setSpeaking(true)
        // Lock the viseme track to the clip's real length when it's known.
        startPerformance(text, isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : undefined)
      }
      audio.onended = () => { if (currentAudio === audio) { setSpeaking(false); stopPerformance() } }
      audio.onpause = () => { if (currentAudio === audio) { setSpeaking(false); stopPerformance() } }
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
  stopAudio()
  getSynth()?.cancel()
  setSpeaking(false)
  stopPerformance()
}
