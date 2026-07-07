// Audio module — one place that owns "which engine + voice speaks this text".
//
// Every content section (story pages, letter names, words, phonics syllables)
// has its own engine+voice row in audio_sections, because Persian TTS quality
// differs sharply per engine AND per content: an engine that reads stories
// fluently can still butcher isolated letter names («ره» → the word "rah").
//
// Engines:
//   piper / edge          → free sidecar (offline Piper, or Edge neural via
//                           internet with automatic Piper fallback)
//   azure / openai /
//   google / elevenlabs   → keyed cloud engines. Keys come from
//                           TTS_<ENGINE>_KEY, falling back to the shared
//                           TTS_API_KEY (legacy single-provider setup).
import { query, queryOne } from '../db'
import { ttsOpenAI, ttsGoogle, ttsAzure, ttsElevenLabs, type SynthOpts } from '../tts/providers'
import { ttsPiper } from '../tts/piper'
import { normalizeForTts } from '../tts/normalize'
import type { TtsSettings } from '../tts/types'
import type { AudioSection, AudioEngine, AudioSectionConfig } from '@koodakbook/shared'

export type { AudioSection, AudioEngine, AudioSectionConfig }

export const AUDIO_SECTIONS: AudioSection[] = ['story', 'letter', 'word', 'phonics', 'math']
export const AUDIO_ENGINES: AudioEngine[] = ['piper', 'edge', 'azure', 'openai', 'google', 'elevenlabs']

const SIDECAR_ENGINES: AudioEngine[] = ['piper', 'edge']
export const CLOUD_ENGINES: AudioEngine[] = ['azure', 'openai', 'google', 'elevenlabs']
const SIDECAR_FALLBACK_VOICE = 'fa-IR-FaridNeural'  // Edge neural; sidecar drops to Piper offline

export interface Clip { buf: Buffer; ext: 'mp3' | 'wav'; engine: AudioEngine; voice: string }

// Read tts_settings here (not via ../tts) — lib/tts imports this module, and a
// circular import would bite at module-init time.
async function getProviderExtras(): Promise<TtsSettings | null> {
  return queryOne<TtsSettings>(
    `select enabled, provider, base_url, model, voice, language, region, format, piper_voice
       from tts_settings where id = 1`,
  )
}

export function engineKey(engine: AudioEngine): string | undefined {
  return process.env[`TTS_${engine.toUpperCase()}_KEY`] || process.env.TTS_API_KEY || undefined
}

/** Sidecar engines are always available; cloud engines need a key. */
export function engineAvailable(engine: AudioEngine): boolean {
  return SIDECAR_ENGINES.includes(engine) || !!engineKey(engine)
}

export async function getSectionConfigs(): Promise<AudioSectionConfig[]> {
  return query<AudioSectionConfig>(
    'select section, engine, voice, premium_engine, premium_voice from audio_sections order by section')
}

export async function getSectionConfig(section: AudioSection): Promise<AudioSectionConfig> {
  const row = await queryOne<AudioSectionConfig>(
    'select section, engine, voice, premium_engine, premium_voice from audio_sections where section = $1', [section])
  return row ?? { section, engine: 'piper', voice: 'fa_IR-amir-medium' }
}

export async function setSectionConfig(
  section: AudioSection, engine: AudioEngine, voice: string,
  premiumEngine: AudioEngine | null, premiumVoice: string | null, by: string | null,
): Promise<void> {
  await query(
    `update audio_sections set engine = $1, voice = $2,
            premium_engine = $3, premium_voice = $4,
            updated_at = now(), updated_by = $5
      where section = $6`,
    [engine, voice, premiumEngine, premiumVoice || null, by, section],
  )
}

/** Synthesize the PREMIUM variant of a section, or null when none configured.
 *  No sidecar fallback — a failed premium clip must not silently become a free
 *  one; the caller counts the error and the free variant still exists. */
export async function synthesizeSectionPremium(
  section: AudioSection, text: string, opts: SynthOpts = {},
): Promise<Clip | null> {
  const cfg = await getSectionConfig(section)
  if (!cfg.premium_engine || !cfg.premium_voice) return null
  return synthesizeWith(cfg.premium_engine, cfg.premium_voice, text, opts)
}

/** Provider-level extras (region, model, base_url) live in tts_settings; they
 *  only apply when that row's provider matches the engine — otherwise each
 *  engine gets Persian-appropriate defaults (ElevenLabs needs eleven_v3: it is
 *  the only ElevenLabs model family that speaks Persian). */
function settingsFor(engine: AudioEngine, voice: string, base: TtsSettings | null): TtsSettings {
  const match = base && base.provider === engine
  return {
    enabled: true,
    provider: engine as TtsSettings['provider'],
    base_url: match ? base.base_url : null,
    model: (match && base.model) || (engine === 'elevenlabs' ? 'eleven_v3' : engine === 'openai' ? 'gpt-4o-mini-tts' : ''),
    voice,
    language: base?.language || 'fa-IR',
    region: base?.region ?? null,
    format: 'mp3',
    piper_voice: base?.piper_voice || 'fa_IR-amir-medium',
  }
}

/** Synthesize with an explicit engine+voice — no fallback, errors surface.
 *  Used by the admin preview button so a broken key/voice is visible. */
export async function synthesizeWith(engine: AudioEngine, voice: string, text: string, opts: SynthOpts = {}): Promise<Clip> {
  const clean = normalizeForTts(text)
  if (SIDECAR_ENGINES.includes(engine)) {
    return { buf: await ttsPiper(voice, clean), ext: 'wav', engine, voice }
  }
  const key = engineKey(engine)
  if (!key) throw new Error(`No API key for ${engine} (set TTS_${engine.toUpperCase()}_KEY or TTS_API_KEY)`)
  const s = settingsFor(engine, voice, await getProviderExtras())
  const ext = opts.wav ? 'wav' : 'mp3'
  switch (engine) {
    case 'openai':     return { buf: await ttsOpenAI(s, clean, key, opts), ext, engine, voice }
    case 'google':     return { buf: await ttsGoogle(s, clean, key, opts), ext, engine, voice }
    case 'azure':      return { buf: await ttsAzure(s, clean, key, opts), ext, engine, voice }
    case 'elevenlabs': return { buf: await ttsElevenLabs(s, clean, key, opts), ext, engine, voice }
    default: throw new Error(`Unknown engine ${engine}`)
  }
}

export function isSidecarEngine(engine: AudioEngine): boolean {
  return SIDECAR_ENGINES.includes(engine)
}

/** Free-tier synthesis: always the sidecar, mapping a cloud-only voice id to
 *  the Edge default. Used for story pages of non-premium accounts when the
 *  story section is configured with a paid engine. */
export async function synthesizeSectionFree(section: AudioSection, text: string): Promise<Clip> {
  const cfg = await getSectionConfig(section)
  const voice = isSidecarEngine(cfg.engine) || /^fa-IR-.+Neural$/.test(cfg.voice) ? cfg.voice : SIDECAR_FALLBACK_VOICE
  return { buf: await ttsPiper(voice, normalizeForTts(text)), ext: 'wav', engine: 'edge', voice }
}

/** Synthesize using the section's configured engine+voice, falling back to the
 *  free sidecar on any cloud failure so batch jobs and story generation never
 *  hard-fail on a flaky key/quota. */
export async function synthesizeSection(section: AudioSection, text: string, opts: SynthOpts = {}): Promise<Clip> {
  const cfg = await getSectionConfig(section)
  try {
    return await synthesizeWith(cfg.engine, cfg.voice, text, opts)
  } catch (err) {
    if (SIDECAR_ENGINES.includes(cfg.engine)) throw err   // sidecar retries internally; nothing below it
    console.error(`${cfg.engine} TTS failed for ${section}, using free sidecar:`, (err as Error).message)
    // Azure voice ids (fa-IR-…Neural) are the same voices Edge serves — keep them.
    const voice = /^fa-IR-.+Neural$/.test(cfg.voice) ? cfg.voice : SIDECAR_FALLBACK_VOICE
    return { buf: await ttsPiper(voice, normalizeForTts(text)), ext: 'wav', engine: 'edge', voice }
  }
}
