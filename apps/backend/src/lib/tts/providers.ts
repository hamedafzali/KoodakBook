import type { TtsSettings } from './types'

// Each adapter takes the (Persian) text + the API key and returns MP3 bytes.
// node 20 has global fetch; all return a Buffer.

export async function ttsOpenAI(s: TtsSettings, text: string, apiKey: string): Promise<Buffer> {
  const base = (s.base_url || 'https://api.openai.com/v1').replace(/\/$/, '')
  const res = await fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: s.model || 'tts-1', voice: s.voice || 'alloy', input: text, response_format: 'mp3' }),
  })
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text().catch(() => '')}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function ttsGoogle(s: TtsSettings, text: string, apiKey: string): Promise<Buffer> {
  // Voice name optional; languageCode drives the Persian voice selection.
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: s.language || 'fa-IR', ...(s.voice ? { name: s.voice } : {}) },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  })
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${await res.text().catch(() => '')}`)
  const json = await res.json() as { audioContent?: string }
  if (!json.audioContent) throw new Error('Google TTS: empty audioContent')
  return Buffer.from(json.audioContent, 'base64')
}

export async function ttsAzure(s: TtsSettings, text: string, apiKey: string): Promise<Buffer> {
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
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
    },
    body: ssml,
  })
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${await res.text().catch(() => '')}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function ttsElevenLabs(s: TtsSettings, text: string, apiKey: string): Promise<Buffer> {
  const voice = s.voice  // ElevenLabs needs a voice_id
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: s.model || 'eleven_multilingual_v2' }),
  })
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text().catch(() => '')}`)
  return Buffer.from(await res.arrayBuffer())
}
