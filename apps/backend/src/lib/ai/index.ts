import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { queryOne } from '../db'
import { generateAnthropic } from './anthropic'
import { generateOpenAICompatible } from './openaiCompat'
import { SCENE_SLUGS } from '@koodakbook/shared'
import type { AiSettings, StoryVars, StoryJSON } from './types'
import { extractJson, buildChatContext, parseChatReply, type ChatTurnOpts } from './chatGuard'

export type { AiSettings, StoryVars, StoryJSON } from './types'
export {
  buildChatContext, parseChatReply, chatDelimiters, validReply,
  type ChatTurnOpts, type ChatHistoryTurn,
} from './chatGuard'

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
        properties: {
          text_persian: { type: 'string' }, text_english: { type: 'string' },
          scene: { type: 'string' }, time: { type: 'string' },
        },
        required: ['text_persian', 'text_english', 'scene', 'time'],
      },
    },
  },
  required: ['title_persian', 'title_english', 'pages'],
} as const

// Text form of the story shape for OpenAI-compatible providers (Anthropic uses
// the JSON schema above). Passed only on the story surface — see openaiCompat.ts.
const STORY_JSON_INSTRUCTION =
  'Respond ONLY with a JSON object of this shape (no markdown, no commentary): ' +
  '{ "title_persian": string, "title_english": string, "pages": [ { "text_persian": string, "text_english": string, "scene": string, "time": "day"|"night" } ] }'

const StorySchema = z.object({
  title_persian: z.string().min(1),
  title_english: z.string().min(1),
  pages: z.array(z.object({
    text_persian: z.string().min(1), text_english: z.string().min(1),
    scene: z.string().optional(), time: z.string().optional(),
  })).min(1),
})

export async function getAiSettings(): Promise<AiSettings | null> {
  return queryOne<AiSettings>(
    `select provider, model, base_url, system_prompt, user_prompt_template, max_tokens, ai_enabled
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
export async function generateStory(settings: AiSettings, vars: StoryVars): Promise<StoryJSON> {
  // Kill switch (migration 047): no provider call when AI is globally disabled.
  // Reuses AiNotConfiguredError so every existing caller already fails closed.
  if (!settings.ai_enabled) throw new AiNotConfiguredError('AI is disabled (kill switch)')
  // One key for whichever provider is currently selected (set in ACM).
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new AiNotConfiguredError('Missing AI_API_KEY')

  const system = settings.system_prompt
  // Scene directive appended in code (not the DB template) so the library list
  // always matches packages/shared/src/scenes.ts.
  const prompt = render(settings.user_prompt_template, vars) +
    `\n\nFor each page also pick where it happens: "scene" must be exactly one of ` +
    `[${SCENE_SLUGS.join(', ')}] and "time" must be "day" or "night". ` +
    `Keep the scene stable across pages unless the story really moves location.`

  let raw: string
  if (settings.provider === 'anthropic') {
    raw = await generateAnthropic({ apiKey, model: settings.model, maxTokens: settings.max_tokens, system, prompt, schema: STORY_JSON_SCHEMA as unknown as Record<string, unknown> })
  } else {
    if (!settings.base_url) throw new Error('base_url required for openai_compatible provider')
    raw = await generateOpenAICompatible({ apiKey, baseURL: settings.base_url, model: settings.model, maxTokens: settings.max_tokens, system, prompt, jsonInstruction: STORY_JSON_INSTRUCTION })
  }

  const parsed = StorySchema.safeParse(extractJson(raw))
  if (!parsed.success) throw new Error('schema validation failed: ' + parsed.error.message)
  return parsed.data
}

/** Translate an array of Persian children's-story lines into one language.
 *  Batched (one call per story) to keep latency + cost down. Returns strings in
 *  the same order; throws on provider/parse failure so callers can leave the
 *  page untranslated rather than store garbage. */
export async function translateLines(settings: AiSettings, lines: string[], targetLanguage: string): Promise<string[]> {
  if (!settings.ai_enabled) throw new AiNotConfiguredError('AI is disabled (kill switch)')
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new AiNotConfiguredError('Missing AI_API_KEY')
  const system =
    `You translate Persian children's story sentences into ${targetLanguage}. ` +
    `Keep each translation simple, warm and natural for a young child; preserve meaning and tone. ` +
    `Reply with ONLY a JSON array of strings — one translation per input, in the same order, nothing else.`
  const prompt = JSON.stringify(lines)

  let raw: string
  if (settings.provider === 'anthropic') {
    raw = await generateAnthropic({ apiKey, model: settings.model, maxTokens: settings.max_tokens, system, prompt, schema: { type: 'object' } as unknown as Record<string, unknown> })
  } else {
    if (!settings.base_url) throw new Error('base_url required for openai_compatible provider')
    raw = await generateOpenAICompatible({ apiKey, baseURL: settings.base_url, model: settings.model, maxTokens: settings.max_tokens, system, prompt })
  }
  const parsed = extractJson(raw)
  if (!Array.isArray(parsed) || parsed.length !== lines.length || !parsed.every(x => typeof x === 'string')) {
    throw new Error('translation: unexpected shape')
  }
  return parsed as string[]
}

/** One constrained character-conversation turn (character plan §4).
 *  The prompt embeds the transcript; output is strict JSON {reply, emotion}.
 *  Throws on provider/parse failure — the route falls back to scripted lines,
 *  so a child never sees a model failure.
 *
 *  Input isolation (Item 3, Pass A): the child's words — the current turn AND
 *  every child turn replayed from history — are UNTRUSTED DATA, never
 *  instructions. The prompt assembly (buildChatContext) and the output gate
 *  (parseChatReply) are pure functions in ./chatGuard, unit-tested in
 *  chatGuard.test.ts. This wrapper only adds the nonce, the env/kill-switch
 *  guard, and the provider call. */
export async function chatTurn(
  settings: AiSettings,
  opts: ChatTurnOpts,
): Promise<{ reply: string; emotion: string }> {
  if (!settings.ai_enabled) throw new AiNotConfiguredError('AI is disabled (kill switch)')
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new AiNotConfiguredError('Missing AI_API_KEY')

  const nonce = randomBytes(6).toString('hex')
  const { system, prompt } = buildChatContext(opts, nonce)

  let raw: string
  if (settings.provider === 'anthropic') {
    raw = await generateAnthropic({ apiKey, model: settings.model, maxTokens: 300, system, prompt, schema: { type: 'object' } as unknown as Record<string, unknown> })
  } else {
    if (!settings.base_url) throw new Error('base_url required for openai_compatible provider')
    raw = await generateOpenAICompatible({ apiKey, baseURL: settings.base_url, model: settings.model, maxTokens: 300, system, prompt })
  }
  return parseChatReply(raw, nonce)
}

const POST_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { text: { type: 'string' } },
  required: ['text'],
} as const
const POST_JSON_INSTRUCTION =
  'Respond ONLY with a JSON object of this shape (no markdown, no commentary): { "text": string }'

const PostSchema = z.object({ text: z.string().min(1) })

export type PostKind = 'weekly_tip' | 'word_roundup' | 'holiday'

const POST_KIND_SYSTEM: Record<PostKind, string> = {
  weekly_tip:
    'تو دستیار محتوای کانال تلگرام «کودک‌بوک» هستی، اپ آموزش فارسی به کودکان. ' +
    'یک نکته‌ی کوتاه و کاربردی برای والدین درباره‌ی یادگیری زبان فارسی یا خواندن با کودک بنویس. ' +
    'لحن گرم و مثبت، حداکثر چهار جمله، فقط فارسی.',
  word_roundup:
    'تو دستیار محتوای کانال تلگرام «کودک‌بوک» هستی. با استفاده از دقیقاً همان کلماتی که در ادامه ' +
    'داده می‌شود (هیچ کلمه‌ی دیگری اضافه نکن) یک معرفی کوتاه و بازیگوش برای والدین بنویس. ' +
    'لحن گرم، حداکثر چهار جمله، فقط فارسی.',
  holiday:
    'تو دستیار محتوای کانال تلگرام «کودک‌بوک» هستی. برای مناسبتی که در ادامه گفته می‌شود یک پیام ' +
    'تبریک کوتاه و گرم برای خانواده‌ها بنویس که به یادگیری فارسی هم اشاره‌ی ملایمی داشته باشد. ' +
    'حداکثر چهار جمله، فقط فارسی.',
}

/** Draft text for the Telegram approval queue (routes/adminPostDrafts.ts).
 *  `context` is data the caller already fetched/knows — grounding facts (the
 *  actual word list, the holiday name) so the model can't invent content
 *  about the app that isn't true. The result still passes through
 *  lib/postGuard's deterministic gate before it's queued; this function only
 *  produces a candidate, it never decides anything is safe to post. */
export async function generatePostText(settings: AiSettings, opts: { kind: PostKind; context: string }): Promise<string> {
  if (!settings.ai_enabled) throw new AiNotConfiguredError('AI is disabled (kill switch)')
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new AiNotConfiguredError('Missing AI_API_KEY')

  const system = POST_KIND_SYSTEM[opts.kind]
  const prompt = opts.context

  let raw: string
  if (settings.provider === 'anthropic') {
    raw = await generateAnthropic({ apiKey, model: settings.model, maxTokens: 300, system, prompt, schema: POST_JSON_SCHEMA as unknown as Record<string, unknown> })
  } else {
    if (!settings.base_url) throw new Error('base_url required for openai_compatible provider')
    raw = await generateOpenAICompatible({ apiKey, baseURL: settings.base_url, model: settings.model, maxTokens: 300, system, prompt, jsonInstruction: POST_JSON_INSTRUCTION })
  }
  const parsed = PostSchema.safeParse(extractJson(raw))
  if (!parsed.success) throw new Error('post text: schema validation failed: ' + parsed.error.message)
  return parsed.data.text
}

/** Whether the single AI key is present in the backend env (admin status). */
export function keyConfigured(): boolean {
  return !!process.env.AI_API_KEY
}
