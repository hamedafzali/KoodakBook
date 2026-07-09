import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { userIsPremium } from '../lib/premiumAudio'
import { requireChildOwner } from '../middleware/childOwner'

const router = Router()

const STRANDS = ['P', 'D', 'V', 'F', 'C'] as const

// ── Probe item shapes ─────────────────────────────────────
interface WordRow   { id: string; persian: string; english: string; audio_url: string | null; audio_url_premium?: string | null }
interface LetterRow { id: string; character: string; name_persian: string; audio_url: string | null; audio_url_premium?: string | null }

interface ProbeChoice {
  id: string
  kind: 'word' | 'letter'
  persian: string
  english?: string
  character?: string
}
interface ProbeQuestion {
  strand: 'V' | 'D' | 'F' | 'C'
  stage: number
  mode: 'listen' | 'read'   // listen = play audio then pick; read = read the shown word then pick
  prompt: string
  audio_url?: string | null
  show_text?: string | null
  choices: ProbeChoice[]
  correct_id: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const wordChoice = (w: WordRow): ProbeChoice => ({ id: w.id, kind: 'word', persian: w.persian, english: w.english })
const letterChoice = (l: LetterRow): ProbeChoice => ({ id: l.id, kind: 'letter', persian: l.name_persian, character: l.character })

// ── GET /api/placement/probe ──────────────────────────────
// A 4-item, stage-gated heuristic probe (V→D→F→C) built from existing content.
// The client presents items in order and stops at the first miss (each item is
// harder than the last), then computes a per-strand placement. Difficulty is
// heuristic (stage + word length) until pilot data calibrates content_items.
router.get('/probe', requireAuth, async (_req, res) => {
  const premium = await userIsPremium(res.locals.userId)
  const aud = (r: { audio_url: string | null; audio_url_premium?: string | null }) =>
    (premium && r.audio_url_premium) || r.audio_url
  const words = await query<WordRow>(
    `select id, persian, english, audio_url, audio_url_premium from words
     where audio_url is not null and audio_url <> '' and stage = 1`
  )
  const letters = await query<LetterRow>(
    `select id, character, name_persian, audio_url, audio_url_premium from letters
     where audio_url is not null and audio_url <> ''`
  )

  // Q1, Q3 and Q4 each consume 3 distinct stage-1 words (9 total, all needing
  // audio); Q2 needs 3 letters. Below that, bail cleanly — the client skips the
  // probe and keeps the default level — rather than building a broken question
  // with undefined distractors.
  if (words.length < 9 || letters.length < 3) {
    res.status(503).json({ data: null, error: 'Not enough content to build a placement probe' })
    return
  }

  const pool = shuffle(words)
  const take = (n: number, exclude: Set<string>) => {
    const out: WordRow[] = []
    for (const w of pool) {
      if (out.length === n) break
      if (!exclude.has(w.id)) { out.push(w); exclude.add(w.id) }
    }
    return out
  }

  const questions: ProbeQuestion[] = []
  const used = new Set<string>()

  // Q1 — Vocabulary (stage 1): hear a common word, pick its picture.
  {
    const [correct, d1, d2] = take(3, used)
    questions.push({
      strand: 'V', stage: 1, mode: 'listen',
      prompt: 'گوش کن. این کدام است؟',
      audio_url: aud(correct),
      choices: shuffle([correct, d1, d2].map(wordChoice)),
      correct_id: correct.id,
    })
  }

  // Q2 — Decoding (stage 2): hear a letter sound, pick the letter.
  {
    const [correct, d1, d2] = shuffle(letters).slice(0, 3)
    questions.push({
      strand: 'D', stage: 2, mode: 'listen',
      prompt: 'این صدا برای کدام حرف است؟',
      audio_url: aud(correct),
      choices: shuffle([correct, d1, d2].map(letterChoice)),
      correct_id: correct.id,
    })
  }

  // Q3 — Fluency (stage 3): READ a written word (no audio), pick its picture.
  {
    const [correct, d1, d2] = take(3, used)
    questions.push({
      strand: 'F', stage: 3, mode: 'read',
      prompt: 'این کلمه را بخوان و عکسش را پیدا کن.',
      show_text: correct.persian,
      choices: shuffle([correct, d1, d2].map(wordChoice)),
      correct_id: correct.id,
    })
  }

  // Q4 — Comprehension/fluency (stage 4): a HARDER word (longest available), read it.
  {
    const remaining = pool.filter(w => !used.has(w.id))
    const hard = [...remaining].sort((a, b) => b.persian.length - a.persian.length)[0] ?? remaining[0]
    used.add(hard.id)
    const [d1, d2] = take(2, used)
    questions.push({
      strand: 'C', stage: 4, mode: 'read',
      prompt: 'این کلمه‌ی سخت‌تر را بخوان.',
      show_text: hard.persian,
      choices: shuffle([hard, d1, d2].map(wordChoice)),
      correct_id: hard.id,
    })
  }

  res.json({ data: { questions }, error: null })
})

// ── POST /api/placement/result ────────────────────────────
const resultSchema = z.object({
  child_id: z.string().uuid(),
  level: z.number().int().min(1).max(4),
  strands: z.object({
    V: z.number().int().min(1).max(4),
    D: z.number().int().min(1).max(4),
    F: z.number().int().min(1).max(4),
    C: z.number().int().min(1).max(4),
  }),
})

router.post('/result', requireAuth, requireChildOwner, async (req, res) => {
  const parsed = resultSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }
  const { child_id, level, strands } = parsed.data
  const userId = res.locals.userId

  const [child] = await query(
    `update children set level = $1, placement_done = true
     where id = $2 and parent_id = $3 returning *`,
    [level, child_id, userId]
  )
  if (!child) { res.status(404).json({ data: null, error: 'Child not found' }); return }

  for (const [strand, lvl] of Object.entries(strands)) {
    await query(
      `insert into child_strand_levels (child_id, strand, level, source, updated_at)
       values ($1, $2, $3, 'placement', now())
       on conflict (child_id, strand) do update
         set level = excluded.level, source = 'placement', updated_at = now()`,
      [child_id, strand, lvl]
    )
  }

  // Append a snapshot so pilot literacy-gain (pre vs post) is measurable (mig-021).
  await query(
    `insert into placement_history (child_id, level, strand_levels) values ($1, $2, $3)`,
    [child_id, level, JSON.stringify(strands)]
  )

  res.json({ data: child, error: null })
})

// ── GET /api/placement/:child_id ──────────────────────────
// Per-strand levels for the child, used to gate/order content. Strands without
// a placement row fall back to children.level so pre-placement children behave
// as before (uniform level across strands).
router.get('/:child_id', requireAuth, requireChildOwner, async (req, res) => {
  const child = await queryOne<{ level: number }>(
    'select level from children where id = $1', [req.params.child_id]
  )
  if (!child) { res.status(404).json({ data: null, error: 'Child not found' }); return }

  const rows = await query<{ strand: string; level: number }>(
    'select strand, level from child_strand_levels where child_id = $1', [req.params.child_id]
  )
  const strand_levels: Record<string, number> = {}
  for (const s of STRANDS) strand_levels[s] = child.level
  for (const r of rows) strand_levels[r.strand] = r.level

  res.json({ data: { level: child.level, strand_levels }, error: null })
})

export default router
