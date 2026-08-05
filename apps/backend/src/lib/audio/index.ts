// Audio module — one place that owns "which engine + voice speaks this text".
//
// Every content section (story pages, letter names, words, phonics syllables)
// has its own engine+voice row in audio_sections, because Persian TTS quality
// differs sharply per engine AND per content: an engine that reads stories
// fluently can still butcher isolated letter names («ره» → the word "rah").
//
// Engines are keyed CLOUD engines only — azure / openai / google / elevenlabs.
// Keys come from TTS_<ENGINE>_KEY, falling back to the shared TTS_API_KEY
// (legacy single-provider setup). The free Piper/Edge sidecar was removed in the
// single-tier collapse (migration 048): one voice per section, served to every
// account. There is no lower-quality server fallback — a synthesis failure
// leaves the item without a file, and the clients narrate it with the browser's
// Web Speech voice instead (see apps/web speakOrPlay). That is the graceful
// degradation path; it is also why a section can never be misconfigured back to
// a worse server voice.
import { query, queryOne } from '../db'
import { ttsOpenAI, ttsGoogle, ttsAzure, ttsElevenLabs, type SynthOpts } from '../tts/providers'
import { normalizeForTts } from '../tts/normalize'
import { recordTtsChars } from '../tts/meter'
import type { TtsSettings } from '../tts/types'
import type { AudioSection, AudioEngine, AudioSectionConfig } from '@koodakbook/shared'

export type { AudioSection, AudioEngine, AudioSectionConfig }

export const AUDIO_SECTIONS: AudioSection[] = ['story', 'letter', 'word', 'phonics', 'math']
export const AUDIO_ENGINES: AudioEngine[] = ['azure', 'openai', 'google', 'elevenlabs']
// Kept as a named export for the (unchanged) admin schemas; identical to
// AUDIO_ENGINES now that every engine is a keyed cloud engine.
export const CLOUD_ENGINES: AudioEngine[] = AUDIO_ENGINES

export interface Clip { buf: Buffer; ext: 'mp3' | 'wav'; engine: AudioEngine; voice: string }

// Read tts_settings here (not via ../tts) — lib/tts imports this module, and a
// circular import would bite at module-init time.
async function getProviderExtras(): Promise<TtsSettings | null> {
  return queryOne<TtsSettings>(
    `select enabled, provider, base_url, model, voice, language, region, format
       from tts_settings where id = 1`,
  )
}

export function engineKey(engine: AudioEngine): string | undefined {
  return process.env[`TTS_${engine.toUpperCase()}_KEY`] || process.env.TTS_API_KEY || undefined
}

/** A cloud engine is available iff its key (or the shared key) is present. */
export function engineAvailable(engine: AudioEngine): boolean {
  return !!engineKey(engine)
}

export async function getSectionConfigs(): Promise<AudioSectionConfig[]> {
  return query<AudioSectionConfig>(
    'select section, engine, voice from audio_sections order by section')
}

export async function getSectionConfig(section: AudioSection): Promise<AudioSectionConfig> {
  const row = await queryOne<AudioSectionConfig>(
    'select section, engine, voice from audio_sections where section = $1', [section])
  return row ?? { section, engine: 'elevenlabs', voice: '' }
}

export async function setSectionConfig(
  section: AudioSection, engine: AudioEngine, voice: string, by: string | null,
): Promise<void> {
  await query(
    `update audio_sections set engine = $1, voice = $2, updated_at = now(), updated_by = $3
      where section = $4`,
    [engine, voice, by, section],
  )
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
  }
}

/** Synthesize with an explicit cloud engine+voice. No server fallback — errors
 *  surface so a broken key/voice is visible (admin preview) and best-effort
 *  callers can leave the item audio-less (clients fall back to browser TTS).
 *  Every successful call meters its character count for the runaway-bill guard. */
export async function synthesizeWith(engine: AudioEngine, voice: string, text: string, opts: SynthOpts = {}): Promise<Clip> {
  const clean = normalizeForTts(text)
  const key = engineKey(engine)
  if (!key) throw new Error(`No API key for ${engine} (set TTS_${engine.toUpperCase()}_KEY or TTS_API_KEY)`)
  const s = settingsFor(engine, voice, await getProviderExtras())
  const ext: 'mp3' | 'wav' = opts.wav ? 'wav' : 'mp3'
  let buf: Buffer
  switch (engine) {
    case 'openai':     buf = await ttsOpenAI(s, clean, key, opts); break
    case 'google':     buf = await ttsGoogle(s, clean, key, opts); break
    case 'azure':      buf = await ttsAzure(s, clean, key, opts); break
    case 'elevenlabs': buf = await ttsElevenLabs(s, clean, key, opts); break
    default: throw new Error(`Unknown engine ${engine}`)
  }
  await recordTtsChars(clean.length)   // best-effort meter; never throws
  return { buf, ext, engine, voice }
}

/** Synthesize using the section's configured (cloud) engine+voice. No fallback —
 *  a failure propagates so best-effort callers leave the item without audio and
 *  the clients narrate it with the browser voice. */
export async function synthesizeSection(section: AudioSection, text: string, opts: SynthOpts = {}): Promise<Clip> {
  const cfg = await getSectionConfig(section)
  return synthesizeWith(cfg.engine, cfg.voice, text, opts)
}
