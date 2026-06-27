import fs from 'fs'
import path from 'path'
import { queryOne } from '../db'
import { ttsOpenAI, ttsGoogle, ttsAzure, ttsElevenLabs } from './providers'
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

/** Synthesize one piece of text to MP3 bytes via the configured provider. */
async function synthesize(s: TtsSettings, text: string): Promise<Buffer> {
  const key = process.env.TTS_API_KEY
  if (!key) throw new Error('Missing TTS_API_KEY')
  switch (s.provider) {
    case 'openai':     return ttsOpenAI(s, text, key)
    case 'google':     return ttsGoogle(s, text, key)
    case 'azure':      return ttsAzure(s, text, key)
    case 'elevenlabs': return ttsElevenLabs(s, text, key)
  }
}

/**
 * Best-effort: synthesize audio for each page and write it under the uploads
 * volume, returning a map of pageId → public /uploads path. Never throws — a TTS
 * failure just leaves that page without audio (بشنو falls back to browser TTS).
 */
export async function synthesizeStoryPages(
  storyId: string,
  pages: { id: string; text_persian: string }[],
): Promise<Record<string, string>> {
  const settings = await getTtsSettings()
  if (!settings?.enabled || !ttsKeyConfigured()) return {}

  const dir = path.resolve(UPLOADS_DIR, 'ai-stories')
  try { fs.mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }

  const out: Record<string, string> = {}
  for (const page of pages) {
    try {
      const audio = await synthesize(settings, page.text_persian)
      const file = `${storyId}-${page.id}.mp3`
      fs.writeFileSync(path.join(dir, file), audio)
      out[page.id] = `/uploads/ai-stories/${file}`
    } catch (err) {
      console.error(`TTS failed for page ${page.id}:`, (err as Error).message)
    }
  }
  return out
}
