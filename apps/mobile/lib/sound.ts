import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { mediaUrl } from './media'

// One module-level player for short one-shot clips (word/letter/math prompts).
// Each play replaces the source; screens that need overlap-free long audio
// (the story reader) manage their own players.
let player: AudioPlayer | null = null
// Bumped on every call so a slow load from an earlier clip can't play over a
// newer one once it finally finishes loading.
let token = 0

// expo-audio players are native "shared objects": touching one whose native
// side isn't ready (fresh handle) or was torn down (Fast Refresh) throws
// "Unable to find the native shared object". Every access is therefore guarded,
// and a dead player is recreated on the next play.
function safe<T>(fn: () => T): T | undefined {
  try { return fn() } catch { return undefined }
}

export function playClip(url: string | null | undefined): void {
  const uri = mediaUrl(url)
  if (!uri) return

  if (!player) player = safe(() => createAudioPlayer({ uri })) ?? null
  else if (safe(() => player!.replace({ uri })) === undefined) {
    // The existing player is dead — replace() threw; make a fresh one.
    player = safe(() => createAudioPlayer({ uri })) ?? null
  }
  const p = player
  if (!p) return

  const mine = ++token
  let played = false
  const go = () => {
    if (played || mine !== token) return
    played = true
    safe(() => p.seekTo(0))
    safe(() => p.play())
  }

  // Play the moment the source is loaded (playing before load is a no-op).
  const sub = safe(() =>
    p.addListener('playbackStatusUpdate', (status) => {
      if (mine !== token) { sub?.remove(); return }
      if (status.isLoaded) { go(); sub?.remove() }
    })
  )
  // …or right away if it was already cached.
  if (safe(() => p.isLoaded)) go()
}
