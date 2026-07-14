import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { synthesizeWith, type AudioEngine } from '../lib/audio'

const router = Router()
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

/* Interactive characters (docs/character-system-plan.md, V1).
 * Public: the child app fetches active characters with their scripted lines.
 * Admin: edit rows/lines; one button voices a character's missing lines with
 * ITS OWN voice (characters are "audio sections with faces"). */

// system_prompt is deliberately excluded from the public payload (V2, server-only).
const PUBLIC_COLS = 'id, slug, name_persian, type, personality, age_band, level, voice_engine, voice_id, animation, topics, teaching_role, home_scene, is_active, sort'

async function withLines(chars: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  if (chars.length === 0) return chars
  const lines = await query<{ character_id: string }>(
    'select id, character_id, trigger, text_persian, audio_url, emotion from character_lines order by trigger')
  for (const c of chars) (c as { lines?: unknown[] }).lines = lines.filter(l => l.character_id === c.id)
  return chars
}

router.get('/', async (_req, res) => {
  const chars = await query<Record<string, unknown>>(
    `select ${PUBLIC_COLS} from characters where is_active order by sort`)
  res.json({ data: await withLines(chars), error: null })
})

// ── Admin ─────────────────────────────────────────────────
router.get('/admin/list', requireAdmin, requirePermission('content.read'), async (_req, res) => {
  const chars = await query<Record<string, unknown>>(
    `select ${PUBLIC_COLS}, system_prompt from characters order by sort`)
  res.json({ data: await withLines(chars), error: null })
})

const charSchema = z.object({
  name_persian: z.string().trim().min(1).max(60).optional(),
  type: z.enum(['child', 'animal', 'fantasy']).optional(),
  personality: z.string().trim().max(300).optional(),
  age_band: z.number().int().min(1).max(3).optional(),
  level: z.number().int().min(1).max(4).optional(),
  voice_engine: z.string().trim().max(20).optional(),
  voice_id: z.string().trim().max(120).optional(),
  topics: z.array(z.string()).optional(),
  teaching_role: z.string().trim().max(40).optional(),
  home_scene: z.string().trim().max(30).optional(),
  system_prompt: z.string().max(4000).optional(),
  is_active: z.boolean().optional(),
})

router.patch('/admin/:id', requireAdmin, requirePermission('content.edit'), async (req, res) => {
  const p = charSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.issues[0]?.message ?? 'Invalid' }); return }
  const d = p.data
  const row = await queryOne(
    `update characters set
       name_persian = coalesce($1, name_persian), type = coalesce($2, type),
       personality = coalesce($3, personality), age_band = coalesce($4, age_band),
       level = coalesce($5, level), voice_engine = coalesce($6, voice_engine),
       voice_id = coalesce($7, voice_id), topics = coalesce($8, topics),
       teaching_role = coalesce($9, teaching_role), home_scene = coalesce($10, home_scene),
       system_prompt = coalesce($11, system_prompt), is_active = coalesce($12, is_active)
     where id = $13 returning ${PUBLIC_COLS}, system_prompt`,
    [d.name_persian ?? null, d.type ?? null, d.personality ?? null, d.age_band ?? null,
     d.level ?? null, d.voice_engine ?? null, d.voice_id ?? null, d.topics ?? null,
     d.teaching_role ?? null, d.home_scene ?? null, d.system_prompt ?? null,
     d.is_active ?? null, req.params.id])
  if (!row) { res.status(404).json({ data: null, error: 'Character not found' }); return }
  res.json({ data: row, error: null })
})

const linesSchema = z.object({
  lines: z.array(z.object({
    trigger: z.string().trim().min(1).max(40),
    text_persian: z.string().trim().min(1).max(300),
    emotion: z.string().trim().max(20).default('happy'),
  })).max(60),
})

// Replace a character's line set (audio for unchanged texts is preserved).
router.put('/admin/:id/lines', requireAdmin, requirePermission('content.edit'), async (req, res) => {
  const p = linesSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: p.error.issues[0]?.message ?? 'Invalid' }); return }
  const existing = await query<{ text_persian: string; audio_url: string | null }>(
    'select text_persian, audio_url from character_lines where character_id = $1', [req.params.id])
  const audioByText = new Map(existing.map(l => [l.text_persian, l.audio_url]))
  await query('delete from character_lines where character_id = $1', [req.params.id])
  for (const l of p.data.lines) {
    await query(
      'insert into character_lines (character_id, trigger, text_persian, emotion, audio_url) values ($1,$2,$3,$4,$5)',
      [req.params.id, l.trigger, l.text_persian, l.emotion, audioByText.get(l.text_persian) ?? null])
  }
  res.json({ data: { ok: true }, error: null })
})

// Voice this character's lines that don't have audio yet (its own voice).
router.post('/admin/:id/audio', requireAdmin, requirePermission('ai.manage'), async (req, res) => {
  const c = await queryOne<{ voice_engine: string; voice_id: string }>(
    'select voice_engine, voice_id from characters where id = $1', [req.params.id])
  if (!c) { res.status(404).json({ data: null, error: 'Character not found' }); return }
  if (!c.voice_id) { res.status(400).json({ data: null, error: 'اول صدای شخصیت را تنظیم کنید' }); return }
  const missing = await query<{ id: string; text_persian: string }>(
    'select id, text_persian from character_lines where character_id = $1 and audio_url is null', [req.params.id])
  const dir = path.resolve(UPLOADS_DIR, 'characters')
  fs.mkdirSync(dir, { recursive: true })
  let done = 0, errors = 0
  for (const line of missing) {
    try {
      const clip = await synthesizeWith(c.voice_engine as AudioEngine, c.voice_id, line.text_persian)
      const file = `${line.id}-${Date.now()}.${clip.ext}`
      fs.writeFileSync(path.join(dir, file), clip.buf)
      await query('update character_lines set audio_url = $1 where id = $2', [`/uploads/characters/${file}`, line.id])
      done++
    } catch (err) {
      errors++
      console.error('character line audio failed', line.id, (err as Error).message)
    }
    await new Promise(r => setTimeout(r, 40))
  }
  res.json({ data: { done, errors, remaining: missing.length - done }, error: null })
})

export default router
