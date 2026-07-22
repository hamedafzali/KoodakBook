import * as FileSystem from 'expo-file-system/legacy'

// Downloads a remote clip to a local cache file and returns its file:// URI.
// Remote HTTP streaming doesn't reliably load in expo-audio under Expo Go, but
// JS/native file downloads over the LAN work — so we play local files instead.
// Cached per URL; concurrent requests for the same URL share one download.
const DIR = FileSystem.cacheDirectory + 'clips/'
const inflight = new Map<string, Promise<string>>()

export function localAudio(remote: string): Promise<string> {
  const existing = inflight.get(remote)
  if (existing) return existing

  const job = (async () => {
    try { await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }) } catch { /* exists */ }
    const name = remote.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
    const path = DIR + name
    const info = await FileSystem.getInfoAsync(path)
    if (info.exists && (info.size ?? 0) > 0) return path
    const res = await FileSystem.downloadAsync(remote, path)
    return res.uri
  })()

  inflight.set(remote, job)
  job.catch(() => inflight.delete(remote))   // let a failed download retry later
  return job
}
