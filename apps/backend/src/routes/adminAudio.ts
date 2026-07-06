import { Router } from 'express'
import { z } from 'zod'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { logAudit } from '../lib/audit'
import {
  AUDIO_SECTIONS, AUDIO_ENGINES, getSectionConfigs, setSectionConfig,
  engineAvailable, synthesizeWith,
  type AudioSection, type AudioEngine,
} from '../lib/audio'

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
  await setSectionConfig(section, parsed.data.engine, parsed.data.voice, res.locals.adminEmail)
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

export default router
