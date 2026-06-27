export type TtsProvider = 'openai' | 'google' | 'azure' | 'elevenlabs'

export interface TtsSettings {
  enabled: boolean
  provider: TtsProvider
  base_url: string | null
  model: string
  voice: string
  language: string
  region: string | null
  format: string
}
