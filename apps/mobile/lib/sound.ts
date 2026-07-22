import { Asset } from 'expo-asset'
import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { mediaUrl } from './media'

// One module-level player for short one-shot clips (word/letter/math/phonics).
// Remote HTTP streaming doesn't reliably load in Expo Go, so each clip is
// downloaded to a local file first (cached by URL), then played — the same
// approach the story reader uses via useAudioPlayer's downloadFirst.
let player: AudioPlayer | null = null
let token = 0
const localCache = new Map<string, string>()

// expo-audio players are native shared objects; touching one whose native side
// isn't ready or was torn down (Fast Refresh) throws. Guard every access.
function safe<T>(fn: () => T): T | undefined {
  try { return fn() } catch { return undefined }
}

function playLocal(uri: string, mine: number) {
  if (mine !== token) return
  if (!player) player = safe(() => createAudioPlayer({ uri })) ?? null
  else if (safe(() => player!.replace({ uri })) === undefined) {
    player = safe(() => createAudioPlayer({ uri })) ?? null
  }
  const p = player
  if (!p) return
  const go = () => {
    if (mine !== token) return
    safe(() => p.seekTo(0))
    safe(() => p.play())
  }
  if (safe(() => p.isLoaded)) go()
  else {
    const sub = safe(() =>
      p.addListener('playbackStatusUpdate', (status) => {
        if (mine !== token) { sub?.remove(); return }
        if (status.isLoaded) { go(); sub?.remove() }
      })
    )
  }
}

export function playClip(url: string | null | undefined): void {
  const remote = mediaUrl(url)
  if (!remote) return
  const mine = ++token

  const cached = localCache.get(remote)
  if (cached) { playLocal(cached, mine); return }

  Asset.fromURI(remote).downloadAsync()
    .then((a) => {
      const local = a.localUri ?? a.uri
      localCache.set(remote, local)
      playLocal(local, mine)
    })
    .catch(() => playLocal(remote, mine))   // fall back to streaming the URL
}
