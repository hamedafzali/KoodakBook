import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { mediaUrl } from './media'

// One module-level player for short one-shot clips (word/letter/math prompts).
// Each play replaces the source; screens that need overlap-free long audio
// (the story reader) manage their own players.
let player: AudioPlayer | null = null
// Bumped on every call so a slow load from an earlier clip can't play over a
// newer one once it finally finishes loading.
let token = 0

export function playClip(url: string | null | undefined): void {
  const uri = mediaUrl(url)
  if (!uri) return
  if (!player) player = createAudioPlayer({ uri })
  else player.replace({ uri })

  const p = player
  const mine = ++token
  let played = false
  const go = () => {
    if (played || mine !== token) return
    played = true
    try { p.seekTo(0) } catch { /* not seekable yet */ }
    p.play()
  }

  // The source loads asynchronously (network). Playing before it's loaded is a
  // no-op, so play now if ready, otherwise the moment loading completes.
  if (p.isLoaded) go()
  else {
    const sub = p.addListener('playbackStatusUpdate', (status) => {
      if (mine !== token) { sub.remove(); return }
      if (status.isLoaded) { go(); sub.remove() }
    })
  }
}
