import * as FileSystem from 'expo-file-system/legacy'
import type { Story, StoryPage } from '@koodakbook/shared'
import { mediaUrl } from './media'

export type FullStory = Story & { pages: StoryPage[] }

/**
 * Offline story packs: a story's JSON plus its images/audio downloaded to
 * documentDirectory/stories/<id>/, with the manifest's asset URLs rewritten
 * to local file:// paths (mediaUrl passes those through). The reader falls
 * back to the pack when the network is gone — قصه در ماشین و هواپیما.
 */
const ROOT = `${FileSystem.documentDirectory}stories/`

const dirFor = (id: string) => `${ROOT}${id}/`
const manifestPath = (id: string) => `${dirFor(id)}manifest.json`

export async function isStoryDownloaded(id: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(manifestPath(id))
  return info.exists
}

async function fetchAsset(url: string | null | undefined, dir: string, name: string): Promise<string | null> {
  const remote = mediaUrl(url)
  if (!remote || remote.startsWith('file:')) return remote
  const ext = remote.split('.').pop()?.split('?')[0] ?? 'bin'
  const local = `${dir}${name}.${ext}`
  try {
    await FileSystem.downloadAsync(remote, local)
    return local
  } catch {
    return null   // asset failed → manifest keeps the remote URL (plays when online)
  }
}

export async function downloadStory(story: FullStory): Promise<void> {
  const dir = dirFor(story.id)
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
  const cover = await fetchAsset(story.cover_url, dir, 'cover')
  const pages: StoryPage[] = []
  for (const p of story.pages) {
    const image = await fetchAsset(p.image_url, dir, `img-${p.page_number}`)
    const audio = await fetchAsset(p.audio_url, dir, `aud-${p.page_number}`)
    pages.push({ ...p, image_url: image ?? p.image_url, audio_url: audio ?? p.audio_url })
  }
  const manifest: FullStory = { ...story, cover_url: cover ?? story.cover_url, pages }
  await FileSystem.writeAsStringAsync(manifestPath(story.id), JSON.stringify(manifest))
}

export async function loadOfflineStory(id: string): Promise<FullStory | null> {
  try {
    if (!(await isStoryDownloaded(id))) return null
    return JSON.parse(await FileSystem.readAsStringAsync(manifestPath(id))) as FullStory
  } catch {
    return null
  }
}

export async function removeStory(id: string): Promise<void> {
  try { await FileSystem.deleteAsync(dirFor(id), { idempotent: true }) } catch { /* already gone */ }
}

/** IDs of every downloaded pack (for the list's ✓ marks and offline mode). */
export async function listDownloadedIds(): Promise<string[]> {
  try {
    return await FileSystem.readDirectoryAsync(ROOT)
  } catch {
    return []   // ROOT doesn't exist yet
  }
}

/** Full manifests of every pack — the offline story catalogue. */
export async function listDownloadedStories(): Promise<FullStory[]> {
  const ids = await listDownloadedIds()
  const stories = await Promise.all(ids.map((id) => loadOfflineStory(id)))
  return stories.filter((s): s is FullStory => s !== null)
}
