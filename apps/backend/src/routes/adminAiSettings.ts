import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { logAudit } from '../lib/audit'
import { keyConfigured } from '../lib/ai'
import type { AiSettings } from '../lib/ai'
import { getTtsSettings, ttsKeyConfigured } from '../lib/tts'

const router = Router()

// GET AI + TTS config, plus whether each key (AI_API_KEY / TTS_API_KEY) is set.
router.get('/ai-settings', requireAdmin, requirePermission('ai.manage'), async (_req, res) => {
  const settings = await queryOne<AiSettings & { updated_at: string; updated_by: string | null }>(
    `select provider, model, base_url, system_prompt, user_prompt_template,
            max_tokens, updated_at, updated_by from ai_settings where id = 1`,
  )
  const tts = await getTtsSettings()
  res.json({
    data: { settings, key_set: keyConfigured(), tts, tts_key_set: ttsKeyConfigured() },
    error: null,
  })
})

// PATCH TTS config (story-audio provider/voice). Key is the separate TTS_API_KEY.
const ttsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['openai', 'google', 'azure', 'elevenlabs']),
  base_url: z.string().trim().url().nullable().optional(),
  model: z.string().trim().max(120).default(''),
  voice: z.string().trim().max(120).default(''),
  language: z.string().trim().max(20).default('fa-IR'),
  region: z.string().trim().max(40).nullable().optional(),
  format: z.string().trim().max(10).default('mp3'),
})

router.patch('/tts-settings', requireAdmin, requirePermission('ai.manage'), async (req, res) => {
  const parsed = ttsSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid' }); return }
  const { enabled, provider, base_url, model, voice, language, region, format } = parsed.data
  await query(
    `update tts_settings set enabled = $1, provider = $2, base_url = $3, model = $4,
            voice = $5, language = $6, region = $7, format = $8, updated_at = now(), updated_by = $9
     where id = 1`,
    [enabled, provider, base_url ?? null, model, voice, language, region ?? null, format, res.locals.adminEmail],
  )
  await logAudit(res.locals.adminEmail, 'tts.settings.update', 'tts_settings', '1', { provider, voice, enabled })
  res.json({ data: { ok: true }, error: null })
})

// PATCH provider / model / endpoint. The API key is a single env var (AI_API_KEY),
// set in ACM — not stored here. Prompts are read-only for now (shown but not
// accepted yet).
const patchSchema = z.object({
  provider: z.enum(['anthropic', 'openai_compatible']),
  model: z.string().trim().min(1).max(120),
  base_url: z.string().trim().url().nullable().optional(),
  max_tokens: z.number().int().min(256).max(32000),
})

router.patch('/ai-settings', requireAdmin, requirePermission('ai.manage'), async (req, res) => {
  const parsed = patchSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid' }); return }
  const { provider, model, base_url, max_tokens } = parsed.data

  if (provider === 'openai_compatible' && !base_url) {
    res.status(400).json({ data: null, error: 'base_url is required for an OpenAI-compatible provider' })
    return
  }

  await query(
    `update ai_settings
       set provider = $1, model = $2, base_url = $3, max_tokens = $4,
           updated_at = now(), updated_by = $5
     where id = 1`,
    [provider, model, provider === 'anthropic' ? null : base_url ?? null, max_tokens, res.locals.adminEmail],
  )
  await logAudit(res.locals.adminEmail, 'ai.settings.update', 'ai_settings', '1', { provider, model })
  res.json({ data: { ok: true }, error: null })
})

export default router
