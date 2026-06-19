import { Router } from 'express'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'

const router = Router()

// JSON schema sent to the model via structured outputs (`output_config.format`).
// Structured outputs require `additionalProperties: false` and don't support
// min/max constraints, so page count is steered via the prompt instead.
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
          text_persian: { type: 'string' },
          text_english: { type: 'string' },
        },
        required: ['text_persian', 'text_english'],
      },
    },
  },
  required: ['title_persian', 'title_english', 'pages'],
} as const

// Validates the model's JSON before we persist it.
const StorySchema = z.object({
  title_persian: z.string().min(1),
  title_english: z.string().min(1),
  pages: z
    .array(
      z.object({
        text_persian: z.string().min(1),
        text_english: z.string().min(1),
      }),
    )
    .min(1),
})

const generateSchema = z.object({
  child_id: z.string().uuid(),
  theme: z.string().min(1).max(60).optional(),
})

// Construct lazily so a missing key never crashes boot — the route returns 503.
let client: Anthropic | null = null
function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!client) client = new Anthropic()
  return client
}

// POST /api/ai/stories/generate — generate a personalized, level-appropriate
// Persian story for a child and save it (scoped to that child).
router.post('/stories/generate', requireAuth, requireChildOwner, async (req, res) => {
  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'child_id (uuid) required' }); return }

  const ai = anthropic()
  if (!ai) {
    res.status(503).json({ data: null, error: 'هوش مصنوعی هنوز فعال نشده است' })
    return
  }

  const { child_id, theme } = parsed.data

  const child = await queryOne<{ name: string; level: number; birth_year: number | null }>(
    'select name, level, birth_year from children where id = $1',
    [child_id],
  )
  if (!child) { res.status(404).json({ data: null, error: 'Child not found' }); return }

  // Anchor vocabulary: a few words at or below the child's level so the story
  // reinforces what they're already learning.
  const words = await query<{ persian: string; english: string }>(
    'select persian, english from words where stage <= $1 order by random() limit 12',
    [child.level],
  )
  const vocab = words.map(w => `${w.persian} (${w.english})`).join(', ')

  const pageGuide =
    child.level <= 2
      ? '4 to 5 pages, one very short, simple sentence per page'
      : '6 to 8 pages, one or two short sentences per page'

  const system =
    "You are an expert author of Persian (Farsi) children's stories for heritage learners " +
    'growing up outside Iran. You write warm, wholesome, age-appropriate stories in clear, ' +
    'natural Tehran-standard Persian, with an accurate English translation for each page. ' +
    'Keep vocabulary simple and concrete, reuse the target words naturally, avoid idioms a ' +
    "beginner wouldn't know, and keep sentences short. Never include anything scary or unsafe."

  const prompt =
    `Write a personalized Persian children's story for ${child.name}` +
    (child.birth_year ? ` (born ${child.birth_year})` : '') +
    `, who is at learning level ${child.level} of 4 (1 = beginner, 4 = reads short stories).\n` +
    `Theme: ${theme ?? 'a friendly everyday adventure'}.\n` +
    `Length: ${pageGuide}.\n` +
    `Where it reads naturally, weave in some of these words the child is learning: ${vocab}.\n` +
    'Return a title (Persian + English) and the pages, each with Persian text and its English translation.'

  let story: z.infer<typeof StorySchema>
  try {
    const msg = await ai.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema: STORY_JSON_SCHEMA } },
    })
    const textBlock = msg.content.find(b => b.type === 'text')
    const raw = textBlock && 'text' in textBlock ? textBlock.text : ''
    const parsed = StorySchema.safeParse(JSON.parse(raw))
    if (!parsed.success) throw new Error('schema validation failed: ' + parsed.error.message)
    story = parsed.data
  } catch (err) {
    console.error('AI story generation failed:', err)
    res.status(502).json({ data: null, error: 'ساختن داستان موفق نبود. دوباره تلاش کن' })
    return
  }

  const [row] = await query<{ id: string }>(
    `insert into stories (title_persian, title_english, stage, ai_generated, created_for_child)
     values ($1, $2, $3, true, $4) returning id`,
    [story.title_persian, story.title_english, child.level, child_id],
  )
  for (let i = 0; i < story.pages.length; i++) {
    const p = story.pages[i]
    await query(
      'insert into story_pages (story_id, page_number, text_persian, text_english) values ($1, $2, $3, $4)',
      [row.id, i + 1, p.text_persian, p.text_english],
    )
  }

  res.status(201).json({
    data: { id: row.id, title_persian: story.title_persian, title_english: story.title_english },
    error: null,
  })
})

// GET /api/ai/stories/:child_id — a child's own AI-generated stories, newest first.
router.get('/stories/:child_id', requireAuth, requireChildOwner, async (req, res) => {
  const rows = await query(
    'select * from stories where created_for_child = $1 order by created_at desc',
    [req.params.child_id],
  )
  res.json({ data: rows, error: null })
})

export default router
