export type TtsProvider = 'openai' | 'google' | 'azure' | 'elevenlabs'

export interface TtsSettings {
  enabled: boolean          // cloud TTS active (premium upgrade)
  provider: TtsProvider     // cloud provider
  base_url: string | null
  model: string
  voice: string             // cloud voice
  language: string
  region: string | null
  format: string
  piper_voice: string       // free baseline (Piper) voice
}
