import { z } from 'zod'
import { queryOne } from '../db'
import { generateAnthropic } from './anthropic'
import { generateOpenAICompatible } from './openaiCompat'
import type { AiSettings, StoryVars, StoryJSON } from './types'

export type { AiSettings, StoryVars, StoryJSON } from './types'

/** Thrown when the selected provider's API key env isn't set → route returns 503. */
export class AiNotConfiguredError extends Error {}

// JSON schema (Anthropic structured outputs). additionalProperties:false required.
const STORY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title_persian: { type: 'string' },
    title_english: { type: 'string' },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { text_persian: { type: 'string' }, text_english: { type: 'string' } },
        required: ['text_persian', 'text_english'],
      },
    },
  },
  required: ['title_persian', 'title_english', 'pages'],
} as const

const StorySchema = z.object({
  title_persian: z.string().min(1),
  title_english: z.string().min(1),
  pages: z.array(z.object({ text_persian: z.string().min(1), text_english: z.string().min(1) })).min(1),
})

export async function getAiSettings(): Promise<AiSettings | null> {
  return queryOne<AiSettings>(
    `select provider, model, base_url, system_prompt, user_prompt_template, max_tokens
       from ai_settings where id = 1`,
  )
}

function render(template: string, v: StoryVars): string {
  const map: Record<string, string> = {
    '{{name}}': v.name, '{{birth}}': v.birth, '{{level}}': String(v.level),
    '{{theme}}': v.theme, '{{pageGuide}}': v.pageGuide, '{{vocab}}': v.vocab,
  }
  return Object.entries(map).reduce((s, [k, val]) => s.split(k).join(val), template)
}

// Tolerant extraction: strip ```json fences / leading prose, keep the object.
function extractJson(raw: string): unknown {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{'), last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  return JSON.parse(s)
}

export async function generateStory(settings: AiSettings, vars: StoryVars): Promise<StoryJSON> {
  // One key for whichever provider is currently selected (set in ACM).
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new AiNotConfiguredError('Missing AI_API_KEY')

  const system = settings.system_prompt
  const prompt = render(settings.user_prompt_template, vars)

  let raw: string
  if (settings.provider === 'anthropic') {
    raw = await generateAnthropic({ apiKey, model: settings.model, maxTokens: settings.max_tokens, system, prompt, schema: STORY_JSON_SCHEMA as unknown as Record<string, unknown> })
  } else {
    if (!settings.base_url) throw new Error('base_url required for openai_compatible provider')
    raw = await generateOpenAICompatible({ apiKey, baseURL: settings.base_url, model: settings.model, maxTokens: settings.max_tokens, system, prompt })
  }

  const parsed = StorySchema.safeParse(extractJson(raw))
  if (!parsed.success) throw new Error('schema validation failed: ' + parsed.error.message)
  return parsed.data
}

/** Whether the single AI key is present in the backend env (admin status). */
export function keyConfigured(): boolean {
  return !!process.env.AI_API_KEY
}
