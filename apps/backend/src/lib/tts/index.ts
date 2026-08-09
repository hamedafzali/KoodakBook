import fs from 'fs'
import path from 'path'
import { queryOne } from '../db'
import { synthesizeSection } from '../audio'
import type { TtsSettings } from './types'

export type { TtsSettings } from './types'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

export async function getTtsSettings(): Promise<TtsSettings | null> {
  return queryOne<TtsSettings>(
    `select enabled, provider, base_url, model, voice, language, region, format
       from tts_settings where id = 1`,
  )
}

export function ttsKeyConfigured(): boolean {
  return !!process.env.TTS_API_KEY
}

/**
 * Synthesize audio for each page and write it under the uploads volume; returns
 * a map of pageId → public /uploads path. Best-effort: a failure just leaves that
 * page without audio (the client narrates it with the browser voice). The voice
 * is the single cloud engine on the 'story' row of audio_sections — every family
 * hears the same best voice; plan differences live in usage caps, not quality.
 */
export async function synthesizeStoryPages(
  storyId: string,
  pages: { id: string; text_persian: string }[],
): Promise<Record<string, string>> {
  const dir = path.resolve(UPLOADS_DIR, 'ai-stories')
  try { fs.mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }

  const out: Record<string, string> = {}
  for (const page of pages) {
    try {
      const clip = await synthesizeSection('story', page.text_persian)
      const file = `${storyId}-${page.id}.${clip.ext}`
      fs.writeFileSync(path.join(dir, file), clip.buf)
      out[page.id] = `/uploads/ai-stories/${file}`
    } catch (err) {
      console.error(`TTS failed for page ${page.id}:`, (err as Error).message)
    }
  }
  return out
}
