import Anthropic from '@anthropic-ai/sdk'

// Native Anthropic adapter — uses structured outputs (json_schema) for reliable
// JSON. (Dropped the adaptive-thinking block: unnecessary for short stories.)
export async function generateAnthropic(opts: {
  apiKey: string; model: string; maxTokens: number; system: string; prompt: string; schema: Record<string, unknown>
}): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey })
  const msg = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
    output_config: { format: { type: 'json_schema', schema: opts.schema } },
  })
  const textBlock = msg.content.find(b => b.type === 'text')
  return textBlock && 'text' in textBlock ? textBlock.text : ''
}
