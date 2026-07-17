import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { mediaUrl } from './media'

// One module-level player for short one-shot clips (word/letter prompts).
// Each play replaces the source; screens that need overlap-free long audio
// (the story reader) manage their own players.
let player: AudioPlayer | null = null

export function playClip(url: string | null | undefined): void {
  const uri = mediaUrl(url)
  if (!uri) return
  if (player) {
    player.replace({ uri })
  } else {
    player = createAudioPlayer({ uri })
  }
  player.seekTo(0)
  player.play()
}
