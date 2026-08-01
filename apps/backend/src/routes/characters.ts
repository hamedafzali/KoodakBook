import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'
import { requireAdmin, requirePermission } from '../middleware/admin'
import { synthesizeWith, type AudioEngine } from '../lib/audio'
import { getAiSettings, chatTurn, AiNotConfiguredError } from '../lib/ai'

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

// Per-emotion tuning saved into the character's `animation` JSON column, under
// `animation.emotions`. Mirrors the library's EmotionSpec (partial — only the
// changed channels are stored). The web app renders characters with these.
const EMOTION_NAMES = [
  'neutral', 'happy', 'excited', 'thinking',
  'encouraging', 'sad', 'surprised', 'sleepy', 'love',
  'confused', 'proud', 'shy',
] as const
const axis = z.number().min(-1).max(1)
const emotionPatchSchema = z.object({
  squint: z.number().min(0).max(1).optional(),
  wide: z.number().min(0).max(1).optional(),
  mouth: z.enum(['soft', 'big', 'frown', 'o']).optional(),
  brow: z.enum(['idle', 'happy', 'excited', 'thinking', 'encouraging', 'sad', 'surprised', 'sleepy', 'confused', 'proud', 'shy']).optional(),
  gaze: z.object({ x: axis, y: axis }).optional(),
}).strict()
const animationSchema = z.object({
  emotions: z.record(z.enum(EMOTION_NAMES), emotionPatchSchema).optional(),
}).passthrough()

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
  animation: animationSchema.optional(),
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
       system_prompt = coalesce($11, system_prompt), is_active = coalesce($12, is_active),
       animation = coalesce($13::jsonb, animation)
     where id = $14 returning ${PUBLIC_COLS}, system_prompt`,
    [d.name_persian ?? null, d.type ?? null, d.personality ?? null, d.age_band ?? null,
     d.level ?? null, d.voice_engine ?? null, d.voice_id ?? null, d.topics ?? null,
     d.teaching_role ?? null, d.home_scene ?? null, d.system_prompt ?? null,
     d.is_active ?? null, d.animation ? JSON.stringify(d.animation) : null, req.params.id])
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

/* ── Conversation engine (plan §4): controlled, never open-ended ─────────
 * Turn Planner (deterministic) → LLM boxed by the character card + child
 * level + allowed vocabulary → deterministic validator → cached TTS in the
 * character's voice. Failures fall back to scripted lines — the child never
 * sees a model error. Every turn is logged for the parent transcript. */

const EMOTIONS = new Set(['happy', 'excited', 'encouraging'])

/** Form validation only (length/script); the vocabulary constraint lives in
 *  the prompt — a strict lexicon check would reject normal function words. */
function validReply(reply: string): boolean {
  if (reply.length < 2 || reply.length > 220) return false
  if (/[A-Za-z]|https?:|www\./.test(reply)) return false                 // Persian only, no links
  if ((reply.match(/[.!؟?]/g) ?? []).length > 3) return false            // ≤ ~2-3 sentences
  if (/آدرس|شماره|تلفن|رمز|پسورد|کجا زندگی/.test(reply)) return false   // never asks where/who
  return true
}

async function scriptedFallback(characterId: string): Promise<{ reply: string; emotion: string; lineAudio: string | null }> {
  const line = await queryOne<{ text_persian: string; emotion: string; audio_url: string | null }>(
    `select text_persian, emotion, audio_url from character_lines
      where character_id = $1 and trigger in ('encourage', 'retry') order by random() limit 1`, [characterId])
  return { reply: line?.text_persian ?? 'آفرین! بازم بگو!', emotion: line?.emotion ?? 'encouraging', lineAudio: line?.audio_url ?? null }
}

const chatSchema = z.object({
  child_id: z.string().uuid(),
  text: z.string().trim().min(1).max(300),
})

router.post('/:slug/chat', requireAuth, requireChildOwner, async (req, res) => {
  const p = chatSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ data: null, error: 'text لازم است' }); return }
  const { child_id, text } = p.data

  const character = await queryOne<{ id: string; name_persian: string; personality: string; system_prompt: string; topics: string[]; voice_engine: string; voice_id: string }>(
    'select id, name_persian, personality, system_prompt, topics, voice_engine, voice_id from characters where slug = $1 and is_active', [req.params.slug])
  if (!character) { res.status(404).json({ data: null, error: 'Character not found' }); return }

  // Daily cap: child turns today across the whole family, from the plan.
  const cap = await queryOne<{ value: string }>(
    `select pf.value from users u
       join plans p on p.key = u.plan
       join plan_features pf on pf.plan_id = p.id and pf.feature_key = 'conversations_per_day'
      where u.id = $1`, [res.locals.userId])
  const perDay = cap ? parseInt(cap.value, 10) : NaN
  if (Number.isFinite(perDay)) {
    const used = await queryOne<{ n: string }>(
      `select count(*) as n from conversations c join children ch on ch.id = c.child_id
        where ch.parent_id = $1 and c.role = 'child' and c.created_at >= date_trunc('day', now())`,
      [res.locals.userId])
    if (Number(used?.n ?? 0) >= perDay) {
      const bye = await queryOne<{ text_persian: string; audio_url: string | null }>(
        `select text_persian, audio_url from character_lines where character_id = $1 and trigger = 'bye' limit 1`, [character.id])
      res.status(429).json({ data: null, error: bye?.text_persian ?? 'امروز خیلی حرف زدیم! فردا بازم بیا! 🌙' })
      return
    }
  }

  const child = await queryOne<{ name: string; level: number }>('select name, level from children where id = $1', [child_id])
  const history = (await query<{ role: 'child' | 'character'; text: string }>(
    `select role, text from conversations where child_id = $1 and character_id = $2
      order by created_at desc limit 6`, [child_id, character.id])).reverse()

  // Allowed vocabulary: the child's stage (+1) filtered by the character's topics.
  const vocab = await query<{ persian: string }>(
    `select persian from words where stage <= $1 ${character.topics.length ? 'and category = any($2)' : ''} limit 220`,
    character.topics.length ? [(child?.level ?? 1) + 1, character.topics] : [(child?.level ?? 1) + 1])

  // Turn Planner: the pedagogical frame is fixed — the LLM fills it, only.
  const system =
    `تو «${character.name_persian}» هستی، دوست بچه‌ها در یک اپ آموزش فارسی. شخصیتت: ${character.personality}. ` +
    (character.system_prompt ? character.system_prompt + ' ' : '') +
    `مخاطبت «${child?.name ?? 'کودک'}» است، سطح فارسی ${child?.level ?? 1} از ۴. ` +
    'در هر نوبت دقیقاً این کار را بکن: (۱) با یک کلمه تشویق کن، (۲) حرف کودک را به شکل درست و کمی کامل‌تر تکرار کن (بدون گفتن «اشتباه»)، (۳) یک سؤال کوتاه و ساده بپرس. ' +
    'حداکثر دو جمله‌ی کوتاه. فقط فارسی، بدون حروف انگلیسی و لینک. هیچ‌وقت اسم خانوادگی، آدرس یا اطلاعات شخصی نپرس. ' +
    (vocab.length ? `تا می‌توانی از این واژه‌ها استفاده کن: ${vocab.map(v => v.persian).join('، ')}` : '')

  const settings = await getAiSettings()
  let reply: string | null = null
  let emotion = 'happy'
  let lineAudio: string | null = null

  if (settings) {
    // one retry on validation failure, then scripted fallback
    for (let attempt = 0; attempt < 2 && !reply; attempt++) {
      try {
        const out = await chatTurn(settings, { system, history, childText: text })
        if (validReply(out.reply)) {
          reply = out.reply
          emotion = EMOTIONS.has(out.emotion) ? out.emotion : 'happy'
        }
      } catch (err) {
        if (err instanceof AiNotConfiguredError) break
        console.error('chat turn failed:', (err as Error).message)
      }
    }
  }
  if (!reply) {
    const fb = await scriptedFallback(character.id)
    reply = fb.reply; emotion = fb.emotion; lineAudio = fb.lineAudio
  }

  // Voice: character's own, cached by content hash (constrained replies repeat).
  let audio_url: string | null = lineAudio
  if (!audio_url) {
    const hash = crypto.createHash('sha256').update(character.id + '|' + reply).digest('hex').slice(0, 20)
    const dir = path.resolve(UPLOADS_DIR, 'characters', 'chat')
    const file = path.join(dir, `${hash}.mp3`)
    if (fs.existsSync(file)) {
      audio_url = `/uploads/characters/chat/${hash}.mp3`
    } else {
      try {
        const clip = await synthesizeWith(character.voice_engine as AudioEngine, character.voice_id, reply)
        fs.mkdirSync(dir, { recursive: true })
        const named = path.join(dir, `${hash}.${clip.ext}`)
        fs.writeFileSync(named, clip.buf)
        audio_url = `/uploads/characters/chat/${hash}.${clip.ext}`
      } catch { /* quota/key down → client falls back to browser TTS */ }
    }
  }

  await query('insert into conversations (child_id, character_id, role, text) values ($1,$2,$3,$4)',
    [child_id, character.id, 'child', text])
  await query('insert into conversations (child_id, character_id, role, text) values ($1,$2,$3,$4)',
    [child_id, character.id, 'character', reply])

  res.json({ data: { reply, emotion, audio_url }, error: null })
})

// Transcript (child app resume + parent review — both are child-owner scoped).
router.get('/:slug/chat/:child_id', requireAuth, requireChildOwner, async (req, res) => {
  const character = await queryOne<{ id: string }>('select id from characters where slug = $1', [req.params.slug])
  if (!character) { res.status(404).json({ data: null, error: 'Character not found' }); return }
  const rows = await query(
    `select role, text, created_at from conversations
      where child_id = $1 and character_id = $2 order by created_at desc limit 50`,
    [req.params.child_id, character.id])
  res.json({ data: (rows as unknown[]).reverse(), error: null })
})

export default router
