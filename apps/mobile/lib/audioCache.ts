import * as FileSystem from 'expo-file-system/legacy'

// Downloads a remote clip to a local cache file and returns its file:// URI.
// Remote HTTP streaming doesn't reliably load in expo-audio under Expo Go, but
// JS/native file downloads over the LAN work — so we play local files instead.
// Cached per URL; concurrent requests for the same URL share one download.
const DIR = FileSystem.cacheDirectory + 'clips/'
const inflight = new Map<string, Promise<string>>()

// The cache file name: a hash of the WHOLE url plus its readable tail. The
// tail alone (the old name) let two long URLs that differ only before their
// last 100 characters -- the same file name under two story folders, or two
// signed URLs -- share one cache file and play each other's clip.
function cacheName(remote: string): string {
  let h = 5381
  for (let i = 0; i < remote.length; i++) h = ((h << 5) + h + remote.charCodeAt(i)) | 0
  const tail = remote.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
  return `${(h >>> 0).toString(36)}_${tail}`
}

export function localAudio(remote: string): Promise<string> {
  const existing = inflight.get(remote)
  if (existing) return existing

  const job = (async () => {
    try { await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }) } catch { /* exists */ }
    const path = DIR + cacheName(remote)
    const info = await FileSystem.getInfoAsync(path)
    if (info.exists && (info.size ?? 0) > 0) return path
    // downloadAsync does not throw on an HTTP error: it writes the error body
    // (a 404/502 HTML page) to the file and resolves. Written straight to
    // `path`, that page was then served from the cache as "the clip" forever
    // (silent audio until the app's cache was cleared). Download to a temp
    // name, and only move a 2xx response into place; anything else rejects,
    // so the caller falls back to streaming and a later play retries.
    const tmp = `${path}.part`
    const res = await FileSystem.downloadAsync(remote, tmp)
    if (res.status < 200 || res.status >= 300) {
      try { await FileSystem.deleteAsync(tmp, { idempotent: true }) } catch { /* best effort */ }
      throw new Error(`clip download failed: HTTP ${res.status}`)
    }
    try { await FileSystem.deleteAsync(path, { idempotent: true }) } catch { /* not there */ }
    await FileSystem.moveAsync({ from: tmp, to: path })
    return path
  })()

  inflight.set(remote, job)
  job.catch(() => inflight.delete(remote))   // let a failed download retry later
  return job
}
