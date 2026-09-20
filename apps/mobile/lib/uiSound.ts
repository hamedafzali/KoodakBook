import { createAudioPlayer, type AudioPlayer } from 'expo-audio'

/**
 * Shared UI feedback sounds -- mobile's equivalent of web's lib/sounds.ts
 * (playTap/playSuccess/playComplete). Before this, mobile had no UI-feedback
 * audio layer at all: `lib/sound.ts` only plays remote CONTENT clips (words,
 * letters, character lines) fetched by URL, never a local tap/success/
 * complete cue. Web fires one of these on nearly every interaction and every
 * "done" screen; mobile was silent throughout (2026-09-20 audit, systemic
 * finding across ~8 screens).
 *
 * The three .wav files under assets/sounds/ are short, original, synthesized
 * tones (not sourced from anywhere) -- see tools/ if they ever need
 * regenerating. Kept tiny (<30KB each) since they bundle into the app binary.
 */

const SOUNDS = {
  tap: require('../assets/sounds/tap.wav'),
  success: require('../assets/sounds/success.wav'),
  complete: require('../assets/sounds/complete.wav'),
} as const

type SoundName = keyof typeof SOUNDS
const players: Partial<Record<SoundName, AudioPlayer>> = {}

// expo-audio players are native shared objects; touching one whose native
// side isn't ready (or was torn down by Fast Refresh) throws -- same guard
// lib/sound.ts already uses for content clips.
function safe<T>(fn: () => T): T | undefined {
  try { return fn() } catch { return undefined }
}

function player(name: SoundName): AudioPlayer | undefined {
  let p = players[name]
  if (!p) {
    p = safe(() => createAudioPlayer(SOUNDS[name]))
    if (p) players[name] = p
  }
  return p
}

function play(name: SoundName) {
  const p = player(name)
  if (!p) return
  safe(() => p.seekTo(0))
  safe(() => p.play())
}

/** A light tap/press cue -- board-game rolls, quiz option taps, nav taps. */
export function playTap() { play('tap') }
/** A correct-answer / positive-feedback cue. */
export function playSuccess() { play('success') }
/** A "you finished!" cue -- pair with <Confetti /> on completion screens. */
export function playComplete() { play('complete') }
