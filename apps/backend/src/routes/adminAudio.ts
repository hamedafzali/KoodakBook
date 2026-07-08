import { Router } from 'express'
import { z } from 'zod'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { logAudit } from '../lib/audit'
import {
  AUDIO_SECTIONS, AUDIO_ENGINES, CLOUD_ENGINES, getSectionConfigs, setSectionConfig,
  engineAvailable, engineKey, synthesizeWith,
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
  premium_engine: z.enum(CLOUD_ENGINES as [AudioEngine, ...AudioEngine[]]).nullable().optional(),
  premium_voice: z.string().trim().max(120).nullable().optional(),
})

router.patch('/audio/sections/:section', requireAdmin, requirePermission('ai.manage'), async (req, res) => {
  const section = req.params.section as AudioSection
  if (!AUDIO_SECTIONS.includes(section)) { res.status(400).json({ data: null, error: 'Unknown section' }); return }
  const parsed = sectionSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid' }); return }
  const { engine, voice, premium_engine, premium_voice } = parsed.data
  if (premium_engine && !premium_voice) {
    res.status(400).json({ data: null, error: 'برای صدای پرمیوم، voice هم لازم است' }); return
  }
  await setSectionConfig(section, engine, voice, premium_engine ?? null, premium_voice ?? null, res.locals.adminEmail)
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

export default router
