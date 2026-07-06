import OpenAI from 'openai'

// One adapter for every OpenAI-compatible API: OpenAI itself plus DeepSeek,
// Moonshot/Kimi, Qwen (DashScope), Zhipu GLM, OpenRouter, Groq, Mistral, … —
// they differ only by base_url + which key env to use. JSON is requested via the
// prompt + json_object mode; the caller tolerates fences and validates with Zod.
export async function generateOpenAICompatible(opts: {
  apiKey: string; baseURL: string; model: string; maxTokens: number; system: string; prompt: string
}): Promise<string> {
  const client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL })
  const res = await client.chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: opts.system +
          '\n\nRespond ONLY with a JSON object of this shape (no markdown, no commentary): ' +
          '{ "title_persian": string, "title_english": string, "pages": [ { "text_persian": string, "text_english": string, "scene": string, "time": "day"|"night" } ] }',
      },
      { role: 'user', content: opts.prompt },
    ],
  })
  return res.choices[0]?.message?.content ?? ''
}
