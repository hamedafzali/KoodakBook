import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAdmin } from '../middleware/admin'
import { upsertTranslations, deleteEntityTranslations } from '../lib/translations'
import { WORD_CATEGORIES, ANIMATION_TEMPLATES, validateAnimationParams } from '@koodakbook/shared'

const router = Router()
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

for (const dir of ['audio', 'images', 'pdfs']) {
  fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const type = (req.params.type ?? 'images') as string
    const allowed = ['audio', 'images', 'pdfs']
    cb(null, path.join(UPLOADS_DIR, allowed.includes(type) ? type : 'images'))
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// Dual-write the language-agnostic translations alongside the legacy columns
// (Phase 2 of the i18n cutover — see docs/i18n-plan.md).
type Row = Record<string, unknown>
const syncWordTranslations = (w: Row) => upsertTranslations('word', String(w.id), [
  { locale: 'fa', field: 'text', value: w.persian as string },
  { locale: 'en', field: 'text', value: w.english as string },
  { locale: 'fa-Latn', field: 'text', value: w.finglish as string | null },
])
const syncStoryTranslations = (s: Row) => upsertTranslations('story', String(s.id), [
  { locale: 'fa', field: 'title', value: s.title_persian as string },
  { locale: 'en', field: 'title', value: s.title_english as string },
])
const syncPageTranslations = (p: Row) => upsertTranslations('story_page', String(p.id), [
  { locale: 'fa', field: 'text', value: p.text_persian as string },
  { locale: 'en', field: 'text', value: p.text_english as string | null },
])

// ── Identity check ───────────────────────────────────────
router.get('/me', requireAdmin, (_req, res) => {
  res.json({ data: { admin: true }, error: null })
})

// ── File upload ───────────────────────────────────────────

router.post('/upload/:type', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) { res.status(400).json({ data: null, error: 'No file uploaded' }); return }
  res.json({ data: { url: `/uploads/${req.params.type}/${req.file.filename}` }, error: null })
})

// ── Words ─────────────────────────────────────────────────

const wordSchema = z.object({
  persian: z.string().min(1),
  english: z.string().min(1),
  finglish: z.string().optional(),
  category: z.enum(WORD_CATEGORIES as unknown as [string, ...string[]]),
  stage: z.number().int().min(1).max(4).default(1),
  audio_url: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  // ── Animation (Phase 0) — authored here or drafted by the generator ──
  animation_template: z.enum(ANIMATION_TEMPLATES as unknown as [string, ...string[]]).nullable().optional(),
  animation_params: z.record(z.unknown()).optional(),
})

/** Validate the animation template+params against the shared registry rules. */
function animationError(data: { animation_template?: string | null; animation_params?: Record<string, unknown> }): string | null {
  if (!data.animation_template) return null
  const v = validateAnimationParams(data.animation_template, data.animation_params ?? {})
  return v.ok ? null : v.errors.join('; ')
}

router.get('/words', requireAdmin, async (_req, res) => {
  const rows = await query('select * from words order by category, persian')
  res.json({ data: rows, error: null })
})

router.post('/words', requireAdmin, async (req, res) => {
  const p = wordSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.message }); return }
  const animErr = animationError(p.data)
  if (animErr) { res.status(400).json({ data: null, error: animErr }); return }
  const { persian, english, finglish, category, stage, audio_url, image_url, animation_template, animation_params } = p.data
  const [row] = await query(
    'insert into words (persian,english,finglish,category,stage,audio_url,image_url,animation_template,animation_params) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',
    [persian, english, finglish ?? null, category, stage, audio_url ?? null, image_url ?? null,
     animation_template ?? null, JSON.stringify(animation_params ?? {})]
  )
  await syncWordTranslations(row)
  res.status(201).json({ data: row, error: null })
})

router.patch('/words/:id', requireAdmin, async (req, res) => {
  const p = wordSchema.partial().safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.message }); return }
  const animErr = animationError(p.data)
  if (animErr) { res.status(400).json({ data: null, error: animErr }); return }
  const fields = Object.entries(p.data).filter(([, v]) => v !== undefined)
  if (fields.length === 0) { res.status(400).json({ data: null, error: 'No fields to update' }); return }
  const setClause = fields.map(([k], i) => `${k} = $${i + 1}`).join(', ')
  // jsonb columns take a serialized value; everything else passes through.
  const values = fields.map(([k, v]) => (k === 'animation_params' ? JSON.stringify(v) : v))
  const row = await queryOne(`update words set ${setClause} where id = $${values.length + 1} returning *`, [...values, req.params.id])
  if (row) await syncWordTranslations(row)
  res.json({ data: row, error: null })
})

router.delete('/words/:id', requireAdmin, async (req, res) => {
  await deleteEntityTranslations('word', String(req.params.id))
  await query('delete from words where id = $1', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// ── Stories ───────────────────────────────────────────────

const storySchema = z.object({
  title_persian: z.string().min(1),
  title_english: z.string().min(1),
  stage: z.number().int().min(1).max(4),
  age_min: z.number().int().nullable().optional(),
  age_max: z.number().int().nullable().optional(),
  cover_url: z.string().nullable().optional(),
  audio_url: z.string().nullable().optional(),
})

router.get('/stories', requireAdmin, async (_req, res) => {
  const rows = await query('select * from stories order by stage, created_at')
  res.json({ data: rows, error: null })
})

router.post('/stories', requireAdmin, async (req, res) => {
  const p = storySchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.message }); return }
  const { title_persian, title_english, stage, age_min, age_max, cover_url, audio_url } = p.data
  const [row] = await query(
    'insert into stories (title_persian,title_english,stage,age_min,age_max,cover_url,audio_url) values ($1,$2,$3,$4,$5,$6,$7) returning *',
    [title_persian, title_english, stage, age_min ?? null, age_max ?? null, cover_url ?? null, audio_url ?? null]
  )
  await syncStoryTranslations(row)
  res.status(201).json({ data: row, error: null })
})

router.patch('/stories/:id', requireAdmin, async (req, res) => {
  const p = storySchema.partial().safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.message }); return }
  const fields = Object.entries(p.data).filter(([, v]) => v !== undefined)
  if (fields.length === 0) { res.status(400).json({ data: null, error: 'No fields to update' }); return }
  const setClause = fields.map(([k], i) => `${k} = $${i + 1}`).join(', ')
  const values = fields.map(([, v]) => v)
  const row = await queryOne(`update stories set ${setClause} where id = $${values.length + 1} returning *`, [...values, req.params.id])
  if (row) await syncStoryTranslations(row)
  res.json({ data: row, error: null })
})

router.delete('/stories/:id', requireAdmin, async (req, res) => {
  // Story delete cascades to story_pages in the DB; clear translations for both
  // the story and its pages first (translations use a loose FK, no cascade).
  await query(
    `delete from content_translations
       where (entity_type = 'story' and entity_id = $1)
          or (entity_type = 'story_page' and entity_id in (select id from story_pages where story_id = $1))`,
    [req.params.id]
  )
  await query('delete from stories where id = $1', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// ── Story pages ───────────────────────────────────────────

const pageSchema = z.object({
  page_number: z.number().int().min(1),
  text_persian: z.string().min(1),
  text_english: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  audio_url: z.string().nullable().optional(),
})

router.get('/stories/:story_id/pages', requireAdmin, async (req, res) => {
  const rows = await query('select * from story_pages where story_id = $1 order by page_number', [req.params.story_id])
  res.json({ data: rows, error: null })
})

router.post('/stories/:story_id/pages', requireAdmin, async (req, res) => {
  const p = pageSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.message }); return }
  const { page_number, text_persian, text_english, image_url, audio_url } = p.data
  const [row] = await query(
    'insert into story_pages (story_id,page_number,text_persian,text_english,image_url,audio_url) values ($1,$2,$3,$4,$5,$6) returning *',
    [req.params.story_id, page_number, text_persian, text_english ?? null, image_url ?? null, audio_url ?? null]
  )
  await syncPageTranslations(row)
  res.status(201).json({ data: row, error: null })
})

router.patch('/stories/:story_id/pages/:id', requireAdmin, async (req, res) => {
  const p = pageSchema.partial().safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.message }); return }
  const fields = Object.entries(p.data).filter(([, v]) => v !== undefined)
  if (fields.length === 0) { res.status(400).json({ data: null, error: 'No fields to update' }); return }
  const setClause = fields.map(([k], i) => `${k} = $${i + 1}`).join(', ')
  const values = fields.map(([, v]) => v)
  const row = await queryOne(`update story_pages set ${setClause} where id = $${values.length + 1} and story_id = $${values.length + 2} returning *`, [...values, req.params.id, req.params.story_id])
  if (row) await syncPageTranslations(row)
  res.json({ data: row, error: null })
})

router.delete('/stories/:story_id/pages/:id', requireAdmin, async (req, res) => {
  await deleteEntityTranslations('story_page', String(req.params.id))
  await query('delete from story_pages where id = $1 and story_id = $2', [req.params.id, req.params.story_id])
  res.json({ data: { ok: true }, error: null })
})

// ── Lesson items ─────────────────────────────────────────

router.get('/lessons', requireAdmin, async (_req, res) => {
  const rows = await query('select * from lessons order by stage, order_index')
  res.json({ data: rows, error: null })
})

router.get('/lessons/:lesson_id/items', requireAdmin, async (req, res) => {
  const rows = await query(
    `select li.*, row_to_json(w.*) as word, row_to_json(l.*) as letter
     from lesson_items li
     left join words   w on w.id = li.word_id
     left join letters l on l.id = li.letter_id
     where li.lesson_id = $1
     order by li.order_index`,
    [req.params.lesson_id]
  )
  res.json({ data: rows, error: null })
})

router.post('/lessons/:lesson_id/items', requireAdmin, async (req, res) => {
  const { word_id, letter_id } = req.body
  if (!word_id && !letter_id) { res.status(400).json({ data: null, error: 'word_id or letter_id required' }); return }

  const [maxRow] = await query<{ max: number }>(
    'select coalesce(max(order_index), 0) as max from lesson_items where lesson_id = $1',
    [req.params.lesson_id]
  )
  const order_index = (maxRow?.max ?? 0) + 1
  const item_type = word_id ? 'word' : 'letter'

  const [row] = await query(
    'insert into lesson_items (lesson_id, item_type, word_id, letter_id, order_index) values ($1,$2,$3,$4,$5) returning *',
    [req.params.lesson_id, item_type, word_id ?? null, letter_id ?? null, order_index]
  )
  res.status(201).json({ data: row, error: null })
})

router.delete('/lessons/:lesson_id/items/:id', requireAdmin, async (req, res) => {
  await query('delete from lesson_items where id = $1 and lesson_id = $2', [req.params.id, req.params.lesson_id])
  res.json({ data: { ok: true }, error: null })
})

router.patch('/lessons/:lesson_id/items/reorder', requireAdmin, async (req, res) => {
  const { order }: { order: { id: string; order_index: number }[] } = req.body
  if (!Array.isArray(order)) { res.status(400).json({ data: null, error: 'order array required' }); return }

  await Promise.all(
    order.map(({ id, order_index }) =>
      query('update lesson_items set order_index = $1 where id = $2 and lesson_id = $3', [order_index, id, req.params.lesson_id])
    )
  )
  res.json({ data: { ok: true }, error: null })
})

// ── Letters audio ─────────────────────────────────────────

router.patch('/letters/:id', requireAdmin, async (req, res) => {
  const { audio_url, example_word_id } = req.body
  const row = await queryOne(
    'update letters set audio_url = coalesce($1, audio_url), example_word_id = coalesce($2, example_word_id) where id = $3 returning *',
    [audio_url ?? null, example_word_id ?? null, req.params.id]
  )
  res.json({ data: row, error: null })
})

// ── Stats ─────────────────────────────────────────────────

router.get('/stats', requireAdmin, async (_req, res) => {
  const [users, children, words, stories, lessons] = await Promise.all([
    queryOne<{ count: string }>('select count(*) from users'),
    queryOne<{ count: string }>('select count(*) from children'),
    queryOne<{ count: string }>('select count(*) from words'),
    queryOne<{ count: string }>('select count(*) from stories'),
    queryOne<{ count: string }>('select count(*) from lessons'),
  ])
  res.json({
    data: {
      users:    parseInt(users?.count    ?? '0'),
      children: parseInt(children?.count ?? '0'),
      words:    parseInt(words?.count    ?? '0'),
      stories:  parseInt(stories?.count  ?? '0'),
      lessons:  parseInt(lessons?.count  ?? '0'),
    },
    error: null,
  })
})

// ── Weekly digest ────────────────────────────────────────
// Trigger the weekly parent digest on demand. Schedule it (e.g. weekly cron)
// to hit this endpoint, or run apps/backend/src/scripts/sendDigests.ts directly.
router.post('/digest/run', requireAdmin, async (_req, res) => {
  const { runWeeklyDigest } = await import('../lib/digest')
  const result = await runWeeklyDigest()
  res.json({ data: result, error: null })
})

export default router
