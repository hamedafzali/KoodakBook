import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'
import { getAiSettings, generateStory, AiNotConfiguredError, type StoryJSON } from '../lib/ai'
import { synthesizeStoryPages } from '../lib/tts'

const router = Router()

const generateSchema = z.object({
  child_id: z.string().uuid(),
  theme: z.string().min(1).max(60).optional(),
})

// POST /api/ai/stories/generate — generate a personalized, level-appropriate
// Persian story for a child and save it (scoped to that child). Provider, model
// and prompts come from ai_settings (admin-configurable).
router.post('/stories/generate', requireAuth, requireChildOwner, async (req, res) => {
  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: 'child_id (uuid) required' }); return }

  const settings = await getAiSettings()
  if (!settings) { res.status(503).json({ data: null, error: 'هوش مصنوعی هنوز پیکربندی نشده است' }); return }

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

  let story: StoryJSON
  try {
    story = await generateStory(settings, {
      name: child.name,
      birth: child.birth_year ? ` (born ${child.birth_year})` : '',
      level: child.level,
      theme: theme ?? 'a friendly everyday adventure',
      pageGuide,
      vocab,
    })
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      res.status(503).json({ data: null, error: 'هوش مصنوعی هنوز فعال نشده است' })
      return
    }
    console.error('AI story generation failed:', err)
    res.status(502).json({ data: null, error: 'ساختن داستان موفق نبود. دوباره تلاش کن' })
    return
  }

  const [row] = await query<{ id: string }>(
    `insert into stories (title_persian, title_english, stage, ai_generated, created_for_child)
     values ($1, $2, $3, true, $4) returning id`,
    [story.title_persian, story.title_english, child.level, child_id],
  )
  const inserted: { id: string; text_persian: string }[] = []
  for (let i = 0; i < story.pages.length; i++) {
    const p = story.pages[i]
    const [pr] = await query<{ id: string }>(
      'insert into story_pages (story_id, page_number, text_persian, text_english) values ($1, $2, $3, $4) returning id',
      [row.id, i + 1, p.text_persian, p.text_english],
    )
    inserted.push({ id: pr.id, text_persian: p.text_persian })
  }

  // Best-effort audio (so بشنو plays a real voice). Never blocks the story:
  // a TTS failure or disabled config just leaves pages text-only.
  try {
    const audioMap = await synthesizeStoryPages(row.id, inserted)
    for (const [pageId, url] of Object.entries(audioMap)) {
      await query('update story_pages set audio_url = $1 where id = $2', [url, pageId])
    }
  } catch (err) {
    console.error('TTS step failed:', (err as Error).message)
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
