import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAdmin } from '../middleware/admin'
import { upsertTranslations, deleteEntityTranslations } from '../lib/translations'
import { WORD_CATEGORIES, ANIMATION_TEMPLATES, validateAnimationParams } from '@koodakbook/shared'
import { asyncHandler } from '../lib/asyncHandler'

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
  res.json({
    data: { admin: true, email: res.locals.adminEmail, permissions: res.locals.adminPermissions ?? [] },
    error: null,
  })
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
  // Diacritized pronunciation override, used only when synthesizing audio —
  // fixes homographs (کرم…) that Persian TTS engines otherwise guess wrong.
  tts_text: z.string().trim().max(200).nullable().optional(),
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
  const { persian, english, finglish, category, stage, tts_text, audio_url, image_url, animation_template, animation_params } = p.data
  const [row] = await query(
    'insert into words (persian,english,finglish,category,stage,tts_text,audio_url,image_url,animation_template,animation_params) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *',
    [persian, english, finglish ?? null, category, stage, tts_text || null, audio_url ?? null, image_url ?? null,
     animation_template ?? null, JSON.stringify(animation_params ?? {})]
  )
  await syncWordTranslations(row)
  res.status(201).json({ data: row, error: null })
})

router.patch('/words/:id', requireAdmin, asyncHandler(async (req, res) => {
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
}))

router.delete('/words/:id', requireAdmin, asyncHandler(async (req, res) => {
  await deleteEntityTranslations('word', String(req.params.id))
  await query('delete from words where id = $1', [req.params.id])
  res.json({ data: { ok: true }, error: null })
}))

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

router.patch('/stories/:id', requireAdmin, asyncHandler(async (req, res) => {
  const p = storySchema.partial().safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.message }); return }
  const fields = Object.entries(p.data).filter(([, v]) => v !== undefined)
  if (fields.length === 0) { res.status(400).json({ data: null, error: 'No fields to update' }); return }
  const setClause = fields.map(([k], i) => `${k} = $${i + 1}`).join(', ')
  const values = fields.map(([, v]) => v)
  const row = await queryOne(`update stories set ${setClause} where id = $${values.length + 1} returning *`, [...values, req.params.id])
  if (row) await syncStoryTranslations(row)
  res.json({ data: row, error: null })
}))

router.delete('/stories/:id', requireAdmin, asyncHandler(async (req, res) => {
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
}))

// ── Story pages ───────────────────────────────────────────

const pageSchema = z.object({
  page_number: z.number().int().min(1),
  text_persian: z.string().min(1),
  text_english: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  audio_url: z.string().nullable().optional(),
})

router.get('/stories/:story_id/pages', requireAdmin, asyncHandler(async (req, res) => {
  const rows = await query('select * from story_pages where story_id = $1 order by page_number', [req.params.story_id])
  res.json({ data: rows, error: null })
}))

router.post('/stories/:story_id/pages', requireAdmin, asyncHandler(async (req, res) => {
  const p = pageSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.message }); return }
  const { page_number, text_persian, text_english, image_url, audio_url } = p.data
  const [row] = await query(
    'insert into story_pages (story_id,page_number,text_persian,text_english,image_url,audio_url) values ($1,$2,$3,$4,$5,$6) returning *',
    [req.params.story_id, page_number, text_persian, text_english ?? null, image_url ?? null, audio_url ?? null]
  )
  await syncPageTranslations(row)
  res.status(201).json({ data: row, error: null })
}))

router.patch('/stories/:story_id/pages/:id', requireAdmin, asyncHandler(async (req, res) => {
  const p = pageSchema.partial().safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.message }); return }
  const fields = Object.entries(p.data).filter(([, v]) => v !== undefined)
  if (fields.length === 0) { res.status(400).json({ data: null, error: 'No fields to update' }); return }
  const setClause = fields.map(([k], i) => `${k} = $${i + 1}`).join(', ')
  const values = fields.map(([, v]) => v)
  const row = await queryOne(`update story_pages set ${setClause} where id = $${values.length + 1} and story_id = $${values.length + 2} returning *`, [...values, req.params.id, req.params.story_id])
  if (row) await syncPageTranslations(row)
  res.json({ data: row, error: null })
}))

router.delete('/stories/:story_id/pages/:id', requireAdmin, asyncHandler(async (req, res) => {
  await deleteEntityTranslations('story_page', String(req.params.id))
  await query('delete from story_pages where id = $1 and story_id = $2', [req.params.id, req.params.story_id])
  res.json({ data: { ok: true }, error: null })
}))

// ── Lesson items ─────────────────────────────────────────

router.get('/lessons', requireAdmin, async (_req, res) => {
  const rows = await query('select * from lessons order by stage, order_index')
  res.json({ data: rows, error: null })
})

router.get('/lessons/:lesson_id/items', requireAdmin, asyncHandler(async (req, res) => {
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
}))

router.post('/lessons/:lesson_id/items', requireAdmin, asyncHandler(async (req, res) => {
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
}))

router.delete('/lessons/:lesson_id/items/:id', requireAdmin, asyncHandler(async (req, res) => {
  await query('delete from lesson_items where id = $1 and lesson_id = $2', [req.params.id, req.params.lesson_id])
  res.json({ data: { ok: true }, error: null })
}))

router.patch('/lessons/:lesson_id/items/reorder', requireAdmin, asyncHandler(async (req, res) => {
  const { order }: { order: { id: string; order_index: number }[] } = req.body
  if (!Array.isArray(order)) { res.status(400).json({ data: null, error: 'order array required' }); return }

  await Promise.all(
    order.map(({ id, order_index }) =>
      query('update lesson_items set order_index = $1 where id = $2 and lesson_id = $3', [order_index, id, req.params.lesson_id])
    )
  )
  res.json({ data: { ok: true }, error: null })
}))

// ── Letters audio ─────────────────────────────────────────

router.patch('/letters/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { audio_url, example_word_id, tts_text } = req.body
  // tts_text is only applied when the key is present in the body (undefined =
  // untouched; '' or null clears it back to the plain letter name).
  const row = await queryOne(
    `update letters set audio_url = coalesce($1, audio_url),
            example_word_id = coalesce($2, example_word_id),
            tts_text = case when $3 then nullif($4, '') else tts_text end
      where id = $5 returning *`,
    [audio_url ?? null, example_word_id ?? null, tts_text !== undefined, tts_text ?? '', req.params.id]
  )
  res.json({ data: row, error: null })
}))

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

// ── Pilot metrics (§11.5 funnel) ─────────────────────────
// Derived from existing tables (no event pipeline). Aggregates the cohort so a
// 10-family beta produces real signal: activation (NSM proxy), weekly retention,
// engagement, and literacy gain from placement_history snapshots.
router.get('/pilot-metrics', requireAdmin, async (_req, res) => {
  const DAY = 86_400_000
  const now = Date.now()

  const [children, sessions, activatedRows, lessonsDone, storiesDone, wordsMastered, gateLog] = await Promise.all([
    query<{ id: string; parent_id: string; created_at: string; placement_done: boolean }>(
      'select id, parent_id, created_at, placement_done from children'),
    query<{ child_id: string; started_at: string; duration_sec: number | null }>(
      'select child_id, started_at, duration_sec from child_sessions'),
    // NSM proxy: the child completed a "real" story (stage ≥ 3)
    query<{ child_id: string }>(
      `select distinct csp.child_id from child_story_progress csp
       join stories s on s.id = csp.story_id where csp.completed and s.stage >= 3`),
    query<{ child_id: string; c: string }>(
      'select child_id, count(*) c from child_lesson_progress where completed group by child_id'),
    query<{ child_id: string; c: string }>(
      'select child_id, count(*) c from child_story_progress where completed group by child_id'),
    query<{ child_id: string; c: string }>(
      `select child_id, count(*) c from child_word_progress
       where mastery in ('mastered','consolidated') group by child_id`),
    query<{ child_id: string; strand: string; at: string; gate_before: number | null; gate_after: number }>(
      `select child_id, strand, at, gate_before, gate_after from gate_recompute_log
       where strand in ('V','D','F') order by child_id, strand, at`),
  ])

  const n = children.length
  const families = new Set(children.map(c => c.parent_id)).size
  const activated = new Set(activatedRows.map(r => r.child_id))

  // Weekly retention: a child is "eligible" for week w once it has aged into it;
  // "active" if it has a session in that week's window since signup.
  const sessByChild = new Map<string, number[]>()
  for (const s of sessions) {
    const arr = sessByChild.get(s.child_id) ?? []
    arr.push(new Date(s.started_at).getTime())
    sessByChild.set(s.child_id, arr)
  }
  const retention = [1, 2, 3, 4].map(week => {
    let eligible = 0, active = 0
    for (const c of children) {
      const created = new Date(c.created_at).getTime()
      const winStart = created + (week - 1) * 7 * DAY
      const winEnd = created + week * 7 * DAY
      if (now < winStart) continue            // hasn't reached this week yet
      eligible++
      if ((sessByChild.get(c.id) ?? []).some(t => t >= winStart && t < winEnd)) active++
    }
    return { week, eligible, active, rate: eligible ? +(active / eligible).toFixed(2) : null }
  })

  const sum = (rows: { child_id: string; c: string }[]) => rows.reduce((a, r) => a + parseInt(r.c), 0)
  const totalSessions = sessions.length
  const totalMin = Math.round(sessions.reduce((a, s) => a + (s.duration_sec ?? 0), 0) / 60)
  const activeLast7 = new Set(sessions.filter(s => new Date(s.started_at).getTime() >= now - 7 * DAY).map(s => s.child_id)).size

  // Literacy gain: mean over {V,D,F} of (gate_after at the latest recompute −
  // a baseline gate), per child, then averaged across children with at least
  // one strand measured. Reads gate_recompute_log — the evidence-driven trail
  // of actual gate moves — rather than raw placement snapshots (docs/
  // re-placement-flow-design.md §4): a placement/reprobe only ever nudges the
  // *prior*, so the metric that should move is what the gate pipeline did
  // with it, not the noisy probe reading itself.
  //
  // gate_before is null on a strand's very first-ever LOGGED recompute — and
  // because gate_recompute_log itself only exists since the progression-
  // rebuild migration (049, 2026-08-06), that genesis row is the norm, not
  // the exception: it's every child's oldest row, old or new account alike.
  // Treating null as "unmeasurable" would exclude nearly the whole cohort.
  // Instead, when the earliest row has no gate_before, its own gate_after IS
  // the correct baseline (the gate the genesis recompute established) — the
  // delta then measures real gain from that point forward. A strand needs
  // ≥2 rows to produce a delta at all; a single row has no elapsed change.
  const logByChildStrand = new Map<string, Map<string, typeof gateLog>>()
  for (const row of gateLog) {
    let byStrand = logByChildStrand.get(row.child_id)
    if (!byStrand) { byStrand = new Map(); logByChildStrand.set(row.child_id, byStrand) }
    const arr = byStrand.get(row.strand) ?? []
    arr.push(row)
    byStrand.set(row.strand, arr)
  }
  let gainChildren = 0, gainSum = 0
  for (const byStrand of logByChildStrand.values()) {
    const strandGains: number[] = []
    for (const rows of byStrand.values()) {
      // rows are already ordered by `at` asc (query-level order by).
      if (rows.length < 2) continue
      const baseline = rows[0].gate_before ?? rows[0].gate_after
      const latest = rows[rows.length - 1]
      strandGains.push(latest.gate_after - baseline)
    }
    if (strandGains.length) {
      gainChildren++
      gainSum += strandGains.reduce((a, b) => a + b, 0) / strandGains.length
    }
  }

  res.json({
    data: {
      families,
      children: n,
      placement_done: children.filter(c => c.placement_done).length,
      activation: { count: activated.size, rate: n ? +(activated.size / n).toFixed(2) : null },
      retention,
      engagement: {
        avg_words_mastered:    n ? +(sum(wordsMastered) / n).toFixed(1) : 0,
        avg_lessons_completed: n ? +(sum(lessonsDone) / n).toFixed(1) : 0,
        avg_stories_completed: n ? +(sum(storiesDone) / n).toFixed(1) : 0,
        avg_session_min:       totalSessions ? +(totalMin / totalSessions).toFixed(1) : 0,
        total_sessions:        totalSessions,
        active_last_7d:        activeLast7,
      },
      literacy_gain: { measured_children: gainChildren, avg_level_gain: gainChildren ? +(gainSum / gainChildren).toFixed(2) : null },
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
