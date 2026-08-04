export type Provider = 'anthropic' | 'openai_compatible'

export interface AiSettings {
  provider: Provider
  model: string
  base_url: string | null
  system_prompt: string
  user_prompt_template: string
  max_tokens: number
  ai_enabled: boolean   // global kill switch (migration 047); false = serve fallbacks, no provider calls
}

/** Values substituted into the user-prompt template ({{name}}, {{vocab}}, …). */
export interface StoryVars {
  name: string
  birth: string      // " (born 2018)" or ""
  level: number
  theme: string
  pageGuide: string
  vocab: string
}

export interface StoryJSON {
  title_persian: string
  title_english: string
  pages: { text_persian: string; text_english: string; scene?: string; time?: string }[]
}
