import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { logAudit } from '../lib/audit'
import fs from 'fs'
import path from 'path'
import {
  AUDIO_SECTIONS, AUDIO_ENGINES, getSectionConfigs, setSectionConfig,
  engineAvailable, engineKey, synthesizeWith, synthesizeSection,
  type AudioSection, type AudioEngine,
} from '../lib/audio'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

const router = Router()

// Per-section voice config + which engines can actually run (key present /
// sidecar always on) so the admin UI can grey out unusable engines.
router.get('/audio/sections', requireAdmin, requirePermission('ai.manage'), async (_req, res) => {
  const sections = await getSectionConfigs()
  const engines = Object.fromEntries(AUDIO_ENGINES.map(e => [e, engineAvailable(e)]))
  res.json({ data: { sections, engines }, error: null })
})

const sectionSchema = z.object({
  engine: z.enum(AUDIO_ENGINES as [AudioEngine, ...AudioEngine[]]),
  voice: z.string().trim().min(1).max(120),
})

router.patch('/audio/sections/:section', requireAdmin, requirePermission('ai.manage'), async (req, res) => {
  const section = req.params.section as AudioSection
  if (!AUDIO_SECTIONS.includes(section)) { res.status(400).json({ data: null, error: 'Unknown section' }); return }
  const parsed = sectionSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid' }); return }
  const { engine, voice } = parsed.data
  await setSectionConfig(section, engine, voice, res.locals.adminEmail)
  await logAudit(res.locals.adminEmail, 'audio.section.update', 'audio_sections', section, parsed.data)
  res.json({ data: { ok: true }, error: null })
})

// Synthesize a short sample with an explicit engine+voice (no fallback — a
// broken key or voice id must be audible/visible before the admin saves).
const previewSchema = z.object({
  engine: z.enum(AUDIO_ENGINES as [AudioEngine, ...AudioEngine[]]),
  voice: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(300),
})

router.post('/audio/preview', requireAdmin, requirePermission('ai.manage'), async (req, res) => {
  const parsed = previewSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid' }); return }
  const { engine, voice, text } = parsed.data
  try {
    const clip = await synthesizeWith(engine, voice, text)
    const mime = clip.ext === 'wav' ? 'audio/wav' : 'audio/mpeg'
    res.json({ data: { audio: `data:${mime};base64,${clip.buf.toString('base64')}` }, error: null })
  } catch (err) {
    res.status(502).json({ data: null, error: (err as Error).message })
  }
})

// Voice catalogue for engines that expose one — the operator picks from a
// dropdown instead of hunting voice ids in a third-party panel.
router.get('/audio/voices', requireAdmin, requirePermission('ai.manage'), async (req, res) => {
  const engine = String(req.query.engine ?? '')
  if (engine !== 'elevenlabs') { res.json({ data: [], error: null }); return }
  const key = engineKey('elevenlabs')
  if (!key) { res.status(400).json({ data: null, error: 'کلید ElevenLabs تنظیم نشده است' }); return }
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(10_000),
    })
    if (r.status === 401) throw new Error('کلید ElevenLabs نامعتبر است (401) — کلید را دوباره از elevenlabs.io → API Keys کپی کنید')
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}`)
    const j = await r.json() as { voices?: { voice_id: string; name: string; labels?: Record<string, string> }[] }
    const voices = (j.voices ?? []).map(v => ({
      id: v.voice_id,
      label: [v.name, v.labels?.gender, v.labels?.age].filter(Boolean).join(' — '),
    }))
    res.json({ data: voices, error: null })
  } catch (err) {
    res.status(502).json({ data: null, error: `دریافت فهرست صداها ممکن نشد: ${(err as Error).message}` })
  }
})

// One-off generation for a single word — the cheap path after adding a word:
// no need to run (or pay for) a whole batch. Single cloud tier now.
router.post('/audio/word/:id', requireAdmin, requirePermission('ai.manage'), async (req, res) => {
  const w = await queryOne<{ id: string; text: string }>(
    'select id, coalesce(tts_text, persian) as text from words where id = $1', [req.params.id])
  if (!w) { res.status(404).json({ data: null, error: 'Word not found' }); return }
  try {
    const clip = await synthesizeSection('word', w.text)
    const dir = path.resolve(UPLOADS_DIR, 'words')
    fs.mkdirSync(dir, { recursive: true })
    const file = `${w.id}-${Date.now()}.${clip.ext}`
    fs.writeFileSync(path.join(dir, file), clip.buf)
    const url = `/uploads/words/${file}`
    await query('update words set audio_url = $1 where id = $2', [url, w.id])
    await query("delete from audio_assets where entity_type = 'word' and entity_id = $1", [w.id])
    res.json({ data: { url }, error: null })
  } catch (err) {
    res.status(502).json({ data: null, error: `ساخت صدا ممکن نشد: ${(err as Error).message}` })
  }
})

// Public voice sample for the pricing page: a story excerpt in the single
// storyteller voice every account hears (audio quality is not a paid tier).
// Written to a fixed path (voice.wav) the landing plays directly; regenerate
// when the voice changes.
const DEMO_TEXT =
  'یکی بود، یکی نبود. پیرزن مهربانی بود که دلش برای دخترش تنگ شده بود. ' +
  'گفت: می‌روم به دیدنش! راه خانه‌ی دختر از جنگل می‌گذشت و یک ماجرای شیرین در راه بود…'

router.post('/audio/demo', requireAdmin, requirePermission('ai.manage'), async (_req, res) => {
  try {
    const clip = await synthesizeSection('story', DEMO_TEXT, { wav: true })
    const dir = path.resolve(UPLOADS_DIR, 'demo')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'voice.wav'), clip.buf)
    await logAudit(res.locals.adminEmail, 'audio.demo.generate', 'audio_sections', 'story',
      { voice: `${clip.engine}:${clip.voice}` })
    res.json({ data: { url: '/uploads/demo/voice.wav' }, error: null })
  } catch (err) {
    res.status(502).json({ data: null, error: `ساخت نمونه ممکن نشد: ${(err as Error).message}` })
  }
})

export default router
