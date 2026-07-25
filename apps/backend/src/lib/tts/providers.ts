import type { TtsSettings } from './types'

// Each adapter takes the (Persian) text + the API key and returns audio bytes.
// node 20 has global fetch; all return a Buffer. Default output is MP3; pass
// opts.wav for WAV (phonics files live at a fixed client-built .wav path, so
// express-static's extension-based Content-Type must match the bytes).
export interface SynthOpts { wav?: boolean }

export async function ttsOpenAI(s: TtsSettings, text: string, apiKey: string, opts: SynthOpts = {}): Promise<Buffer> {
  const base = (s.base_url || 'https://api.openai.com/v1').replace(/\/$/, '')
  const res = await fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: s.model || 'gpt-4o-mini-tts', voice: s.voice || 'alloy', input: text,
      response_format: opts.wav ? 'wav' : 'mp3',
    }),
  })
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text().catch(() => '')}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function ttsGoogle(s: TtsSettings, text: string, apiKey: string, opts: SynthOpts = {}): Promise<Buffer> {
  // Voice name optional; languageCode drives the Persian voice selection.
  // LINEAR16 responses already carry a WAV header.
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: s.language || 'fa-IR', ...(s.voice ? { name: s.voice } : {}) },
      audioConfig: { audioEncoding: opts.wav ? 'LINEAR16' : 'MP3' },
    }),
  })
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${await res.text().catch(() => '')}`)
  const json = await res.json() as { audioContent?: string }
  if (!json.audioContent) throw new Error('Google TTS: empty audioContent')
  return Buffer.from(json.audioContent, 'base64')
}

export async function ttsAzure(s: TtsSettings, text: string, apiKey: string, opts: SynthOpts = {}): Promise<Buffer> {
  const region = s.region || 'westeurope'
  const lang = s.language || 'fa-IR'
  const voice = s.voice || 'fa-IR-DilaraNeural'
  const ssml =
    `<speak version="1.0" xml:lang="${lang}"><voice xml:lang="${lang}" name="${voice}">` +
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
    `</voice></speak>`
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': opts.wav ? 'riff-24khz-16bit-mono-pcm' : 'audio-24khz-48kbitrate-mono-mp3',
    },
    body: ssml,
  })
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${await res.text().catch(() => '')}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function ttsElevenLabs(s: TtsSettings, text: string, apiKey: string, opts: SynthOpts = {}): Promise<Buffer> {
  const voice = s.voice  // ElevenLabs needs a voice_id
  // Persian is only supported by the eleven_v3 model family (multilingual_v2
  // does NOT include fa) — keep that the default for this fa-only app.
  const format = opts.wav ? 'pcm_22050' : 'mp3_44100_128'
  const model = s.model || 'eleven_v3'
  // Force Persian. Without language_code ElevenLabs auto-detects from context,
  // which misfires on our short clips (single words/letters/numbers/syllables).
  // Not supported on multilingual_v2, so omit it there.
  const body: Record<string, unknown> = { text, model_id: model }
  if (model !== 'eleven_multilingual_v2') body.language_code = 'fa'
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${format}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text().catch(() => '')}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return opts.wav ? pcmToWav(buf, 22050) : buf   // pcm_* is headerless raw PCM
}

/** Wrap raw 16-bit mono little-endian PCM in a minimal WAV (RIFF) header. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)          // PCM chunk size
  header.writeUInt16LE(1, 20)           // PCM format
  header.writeUInt16LE(1, 22)           // mono
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)  // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32)           // block align
  header.writeUInt16LE(16, 34)          // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}
