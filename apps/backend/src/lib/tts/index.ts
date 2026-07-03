import fs from 'fs'
import path from 'path'
import { queryOne } from '../db'
import { ttsOpenAI, ttsGoogle, ttsAzure, ttsElevenLabs } from './providers'
import { ttsPiper } from './piper'
import { normalizeForTts } from './normalize'
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

/** Premium cloud provider — needs TTS_API_KEY. Returns audio in the configured format. */
async function cloudSynthesize(s: TtsSettings, text: string): Promise<Buffer> {
  const key = process.env.TTS_API_KEY
  if (!key) throw new Error('Missing TTS_API_KEY')
  switch (s.provider) {
    case 'openai':     return ttsOpenAI(s, text, key)
    case 'google':     return ttsGoogle(s, text, key)
    case 'azure':      return ttsAzure(s, text, key)
    case 'elevenlabs': return ttsElevenLabs(s, text, key)
  }
}

/** One page → audio bytes + file extension. Premium accounts use the cloud
 *  provider when it's enabled + keyed; everyone else (and any cloud failure)
 *  falls back to the free sidecar (Edge TTS voice or Piper — always WAV). */
async function synthOne(s: TtsSettings, text: string, useCloud: boolean): Promise<{ buf: Buffer; ext: string }> {
  const clean = normalizeForTts(text)
  if (useCloud) {
    try { return { buf: await cloudSynthesize(s, clean), ext: s.format || 'mp3' } }
    catch (err) { console.error('Cloud TTS failed, using free sidecar:', (err as Error).message) }
  }
  return { buf: await ttsPiper(s.piper_voice || 'fa_IR-amir-medium', clean), ext: 'wav' }
}

/**
 * Synthesize audio for each page and write it under the uploads volume; returns
 * a map of pageId → public /uploads path. Best-effort: a failure just leaves that
 * page without audio. Piper is the free baseline (every account); premium accounts
 * with the cloud provider enabled + keyed get the higher-quality voice.
 */
export async function synthesizeStoryPages(
  storyId: string,
  pages: { id: string; text_persian: string }[],
  opts: { premium: boolean },
): Promise<Record<string, string>> {
  const settings = await getTtsSettings()
  if (!settings) return {}
  const useCloud = opts.premium && settings.enabled && ttsKeyConfigured()

  const dir = path.resolve(UPLOADS_DIR, 'ai-stories')
  try { fs.mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }

  const out: Record<string, string> = {}
  for (const page of pages) {
    try {
      const { buf, ext } = await synthOne(settings, page.text_persian, useCloud)
      const file = `${storyId}-${page.id}.${ext}`
      fs.writeFileSync(path.join(dir, file), buf)
      out[page.id] = `/uploads/ai-stories/${file}`
    } catch (err) {
      console.error(`TTS failed for page ${page.id}:`, (err as Error).message)
    }
  }
  return out
}
