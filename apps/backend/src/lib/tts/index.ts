import fs from 'fs'
import path from 'path'
import { queryOne } from '../db'
import { synthesizeSection, synthesizeSectionFree, synthesizeSectionPremium, getSectionConfig, isSidecarEngine } from '../audio'
import type { TtsSettings } from './types'

export type { TtsSettings } from './types'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

export async function getTtsSettings(): Promise<TtsSettings | null> {
  return queryOne<TtsSettings>(
    `select enabled, provider, base_url, model, voice, language, region, format, piper_voice
       from tts_settings where id = 1`,
  )
}

export function ttsKeyConfigured(): boolean {
  return !!process.env.TTS_API_KEY
}

/**
 * Synthesize audio for each page and write it under the uploads volume; returns
 * a map of pageId → public /uploads path. Best-effort: a failure just leaves that
 * page without audio. The voice comes from the 'story' row of audio_sections;
 * paid engines only run for premium accounts (with the cloud toggle on) — free
 * accounts always get the sidecar (Edge neural / offline Piper).
 */
export async function synthesizeStoryPages(
  storyId: string,
  pages: { id: string; text_persian: string }[],
  opts: { premium: boolean },
): Promise<Record<string, string>> {
  const settings = await getTtsSettings()
  const cfg = await getSectionConfig('story')
  const paidAllowed = opts.premium && (settings?.enabled ?? false)
  const useConfigured = isSidecarEngine(cfg.engine) || paidAllowed

  const dir = path.resolve(UPLOADS_DIR, 'ai-stories')
  try { fs.mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }

  const out: Record<string, string> = {}
  for (const page of pages) {
    try {
      // Premium accounts: dedicated premium engine first (when configured),
      // then the section's free config; free accounts: sidecar only.
      let clip = null
      if (paidAllowed) {
        try { clip = await synthesizeSectionPremium('story', page.text_persian) }
        catch (err) { console.error('premium story TTS failed, using free config:', (err as Error).message) }
      }
      if (!clip) clip = useConfigured
        ? await synthesizeSection('story', page.text_persian)
        : await synthesizeSectionFree('story', page.text_persian)
      const file = `${storyId}-${page.id}.${clip.ext}`
      fs.writeFileSync(path.join(dir, file), clip.buf)
      out[page.id] = `/uploads/ai-stories/${file}`
    } catch (err) {
      console.error(`TTS failed for page ${page.id}:`, (err as Error).message)
    }
  }
  return out
}
