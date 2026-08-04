import OpenAI from 'openai'

// One adapter for every OpenAI-compatible API: OpenAI itself plus DeepSeek,
// Moonshot/Kimi, Qwen (DashScope), Zhipu GLM, OpenRouter, Groq, Mistral, … —
// they differ only by base_url + which key env to use. JSON is requested via
// json_object mode; the caller tolerates fences and validates with Zod.
//
// The JSON *shape* is per-surface (`jsonInstruction`) — a story asks for the
// story object, chat asks for {reply,emotion}, translate asks for an array.
// Previously the story shape was hardcoded here and leaked onto every surface,
// contradicting the chat/translate prompts. Callers whose prompt already states
// the shape pass nothing. (json_object mode needs the word "json" somewhere in
// the messages — every surface's own instruction includes it.)
export async function generateOpenAICompatible(opts: {
  apiKey: string; baseURL: string; model: string; maxTokens: number; system: string; prompt: string
  jsonInstruction?: string
}): Promise<string> {
  const client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL })
  const res = await client.chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: opts.system + (opts.jsonInstruction ? '\n\n' + opts.jsonInstruction : '') },
      { role: 'user', content: opts.prompt },
    ],
  })
  return res.choices[0]?.message?.content ?? ''
}
