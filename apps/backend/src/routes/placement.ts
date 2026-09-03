import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'
import { promoteStrands } from '../lib/strands'
import { isReprobeDue, nextEligibleAt, DEFAULT_REPROBE_CONFIG, type ReprobeConfig } from '../lib/reprobe'
import { DEFAULT_PRIOR_K } from '../lib/gate'
import {
  scoreProbe, pickStaircaseItems, wordDifficulty, letterRank,
  DEFAULT_PLACEMENT_MAX_ITEMS, placementBranchingEnabled,
  type LetterInfo, type ProbeResults, type StaircasePick,
} from '../lib/probe'

const router = Router()

const STRANDS = ['P', 'D', 'V', 'F', 'C'] as const

// ── Probe item shapes ─────────────────────────────────────
interface WordRow   { id: string; persian: string; english: string; stage: number; audio_url: string | null }
interface LetterRow { id: string; character: string; name_persian: string; group: number; order_in_group: number; audio_url: string | null }

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
interface ProbeStaircase {
  mid: ProbeQuestion | null
  hard: ProbeQuestion | null
  easy: ProbeQuestion | null
}
interface ProbeBank {
  V: ProbeStaircase
  D: ProbeStaircase
  F: ProbeStaircase
  C: ProbeQuestion | null
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

/** Build the up-to-2-distractor choice list for one item from the rest of its
 *  pool. A pool of exactly 3 (the minimum a strand needs at all — see the
 *  MIN_POOL guard below) yields the same 2 distractors every time; anything
 *  larger shuffles for variety. Never called on a pool smaller than 3. */
function distractorsFor<T>(item: T, pool: T[], idOf: (t: T) => string): T[] {
  return shuffle(pool.filter(x => idOf(x) !== idOf(item))).slice(0, 2)
}

const MIN_POOL = 3   // 1 correct + 2 distractors — the smallest a valid item needs

function buildWordStaircase(
  strand: 'V' | 'F', mode: 'listen' | 'read', prompt: string,
  pool: WordRow[], letters: LetterInfo[],
): ProbeStaircase {
  if (pool.length < MIN_POOL) return { mid: null, hard: null, easy: null }
  const picks = pickStaircaseItems(pool, w => wordDifficulty(w, letters), w => w.id)
  const toQuestion = (w: WordRow): ProbeQuestion => {
    const [d1, d2] = distractorsFor(w, pool, x => x.id)
    return {
      strand, stage: w.stage, mode, prompt,
      audio_url: mode === 'listen' ? w.audio_url : undefined,
      show_text: mode === 'read' ? w.persian : undefined,
      choices: shuffle([w, d1, d2].map(wordChoice)),
      correct_id: w.id,
    }
  }
  return {
    mid: picks.mid ? toQuestion(picks.mid) : null,
    hard: picks.hard ? toQuestion(picks.hard) : null,
    easy: picks.easy ? toQuestion(picks.easy) : null,
  }
}

function buildLetterStaircase(pool: LetterRow[]): ProbeStaircase {
  if (pool.length < MIN_POOL) return { mid: null, hard: null, easy: null }
  const letters: LetterInfo[] = pool.map(l => ({ character: l.character, group: l.group, orderInGroup: l.order_in_group }))
  const byId = new Map(pool.map(l => [l.id, l]))
  const picks: StaircasePick<LetterInfo & { id: string }> = pickStaircaseItems(
    pool.map(l => ({ id: l.id, character: l.character, group: l.group, orderInGroup: l.order_in_group })),
    letterRank, l => l.id,
  )
  const toQuestion = (pick: { id: string }): ProbeQuestion => {
    const l = byId.get(pick.id)!
    const [d1, d2] = distractorsFor(l, pool, x => x.id)
    return {
      strand: 'D', stage: 2, mode: 'listen',
      prompt: 'این صدا برای کدام حرف است؟',
      audio_url: l.audio_url,
      choices: shuffle([l, d1, d2].map(letterChoice)),
      correct_id: l.id,
    }
  }
  return {
    mid: picks.mid ? toQuestion(picks.mid) : null,
    hard: picks.hard ? toQuestion(picks.hard) : null,
    easy: picks.easy ? toQuestion(picks.easy) : null,
  }
}

/** C stays single/unbranched (§3, unchanged in kind from the pre-rebuild
 *  probe): the single hardest item available in `pool`, excluding anything
 *  F already used so the two never repeat the same word. */
function buildCItem(pool: WordRow[], exclude: Set<string>, letters: LetterInfo[]): ProbeQuestion | null {
  const remaining = pool.filter(w => !exclude.has(w.id))
  if (remaining.length < MIN_POOL) return null
  const hardest = [...remaining].sort((a, b) => wordDifficulty(b, letters) - wordDifficulty(a, letters))[0]
  const [d1, d2] = distractorsFor(hardest, remaining, w => w.id)
  return {
    strand: 'C', stage: hardest.stage, mode: 'read',
    prompt: 'این کلمه‌ی سخت‌تر را بخوان.',
    show_text: hardest.persian,
    choices: shuffle([hardest, d1, d2].map(wordChoice)),
    correct_id: hardest.id,
  }
}

function placementMaxItems(): number {
  const n = Number(process.env.PLACEMENT_MAX_ITEMS)
  return Number.isFinite(n) ? n : DEFAULT_PLACEMENT_MAX_ITEMS
}

function stripBranch(s: ProbeStaircase): ProbeStaircase {
  return { mid: s.mid, hard: null, easy: null }
}

// ── GET /api/placement/probe ──────────────────────────────
// A composite-difficulty, one-step-staircase probe (docs/placement-probe-
// rebuild.md): V (vocabulary, stage-1 words, listen→pick picture), D
// (decoding, letters, listen→pick letter) and F (fluency, stage 2+ words,
// read→pick picture) each get a mid item plus a hard/easy branch chosen from
// the mid result; C stays a single unbranched "hardest available word" item,
// unchanged in kind. Every strand degrades independently — a strand with too
// little content to build even one valid item (MIN_POOL) is simply skipped
// (all-null bank entries), rather than failing the whole probe; only a
// probe with NOTHING usable anywhere 503s, so the client can fall back to
// the default level exactly as before.
router.get('/probe', requireAuth, async (_req, res) => {
  const wordsV = await query<WordRow>(
    `select id, persian, english, stage, audio_url from words
     where stage = 1 and audio_url is not null and audio_url <> ''`
  )
  // Fluency/comprehension read real stage 2+ content (the bug this rebuild
  // fixes — the pre-rebuild probe re-read the stage-1 pool for these under
  // cosmetic "stage 3"/"stage 4" labels). No audio requirement: 'read' mode
  // never plays audio.
  const wordsF = await query<WordRow>(
    `select id, persian, english, stage, audio_url from words where stage >= 2`
  )
  const letterRows = await query<LetterRow>(
    `select id, character, name_persian, "group", order_in_group, audio_url from letters
     where audio_url is not null and audio_url <> ''`
  )

  const branchingEnabled = placementBranchingEnabled(placementMaxItems())
  const letterInfos: LetterInfo[] = letterRows.map(l => ({ character: l.character, group: l.group, orderInGroup: l.order_in_group }))

  let bank: ProbeBank = {
    V: buildWordStaircase('V', 'listen', 'گوش کن. این کدام است؟', wordsV, letterInfos),
    D: buildLetterStaircase(letterRows),
    F: buildWordStaircase('F', 'read', 'این کلمه را بخوان و عکسش را پیدا کن.', wordsF, letterInfos),
    C: buildCItem(wordsF, new Set(), letterInfos),
  }
  if (!branchingEnabled) {
    // A13 fallback: budget below the full 7 — one item per strand, the
    // pre-rebuild shape — rather than half-administering a staircase.
    bank = { V: stripBranch(bank.V), D: stripBranch(bank.D), F: stripBranch(bank.F), C: bank.C }
  }

  const usable = bank.V.mid || bank.D.mid || bank.F.mid || bank.C
  if (!usable) {
    res.status(503).json({ data: null, error: 'Not enough content to build a placement probe' })
    return
  }

  res.json({ data: bank, error: null })
})

// ── POST /api/placement/result ────────────────────────────
// Body carries the RAW per-item results the client walked through
// (probeFlow.ts's ProbeResults), not a precomputed level/strands — scoring
// (§5) needs gate.ts's w(n), which is backend-only, so it happens here.
const resultsSchema = z.object({
  V: z.array(z.boolean()).max(2),
  D: z.array(z.boolean()).max(2),
  F: z.array(z.boolean()).max(2),
  C: z.boolean().nullable(),
})
const resultSchema = z.object({
  child_id: z.string().uuid(),
  results: resultsSchema,
})

function probeK(): number {
  const n = Number(process.env.PROGRESSION_PRIOR_K)
  return Number.isFinite(n) ? n : DEFAULT_PRIOR_K
}

router.post('/result', requireAuth, requireChildOwner, async (req, res) => {
  const parsed = resultSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }
  const { child_id, results } = parsed.data
  const userId = res.locals.userId
  const { level, strands, confidence } = scoreProbe(results as ProbeResults, probeK())

  const [child] = await query(
    `update children set level = $1, placement_done = true
     where id = $2 and parent_id = $3 returning *`,
    [level, child_id, userId]
  )
  if (!child) { res.status(404).json({ data: null, error: 'Child not found' }); return }

  for (const [strand, lvl] of Object.entries(strands)) {
    // Placement seeds BOTH the gate (level) and the retained prior (prior_level):
    // the gate is where the child starts; the prior is what later recomputes decay
    // away from as real evidence accrues (docs/placement-progression-rebuild.md §3).
    // `confidence` (§5 of the probe rebuild doc) is the SAME w(n) gate.ts uses for
    // real evidence, fed one unit of n per probe item actually resolved.
    await query(
      `insert into child_strand_levels (child_id, strand, level, prior_level, confidence, source, updated_at)
       values ($1, $2, $3, $3, $4, 'placement', now())
       on conflict (child_id, strand) do update
         set level = excluded.level, prior_level = excluded.prior_level,
             confidence = excluded.confidence, source = 'placement', updated_at = now()`,
      [child_id, strand, lvl, confidence[strand as keyof typeof confidence]]
    )
  }

  // Append a snapshot — the audit trail of what each probe read (mig-021),
  // tagged 'onboarding' so it's told apart from a later reprobe (mig-054,
  // docs/re-placement-flow-design.md §3). Pilot literacy-gain no longer reads
  // this table directly (see routes/admin.ts) but re-placement's due-check
  // does: it schedules off this row's taken_at.
  await query(
    `insert into placement_history (child_id, level, strand_levels, kind) values ($1, $2, $3, 'onboarding')`,
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

// ── Re-placement (docs/re-placement-flow-design.md) ───────
// Runtime-configurable, same pattern as strands.ts's gateConfig — read at call
// time so a pilot can retune without a release. Every default is unvalidated
// (design doc §6, A10/A11).
function reprobeConfig(): ReprobeConfig {
  const num = (v: string | undefined, d: number) => {
    const n = v === undefined ? NaN : Number(v)
    return Number.isFinite(n) ? n : d
  }
  return {
    intervalDays: num(process.env.PLACEMENT_REPROBE_INTERVAL_DAYS, DEFAULT_REPROBE_CONFIG.intervalDays),
    jitterDays: num(process.env.PLACEMENT_REPROBE_JITTER_DAYS, DEFAULT_REPROBE_CONFIG.jitterDays),
  }
}

// ── GET /api/placement/:child_id/reprobe-due ──────────────
// Checked once per session at home-screen load (design doc §1) — never polled,
// never pushed. A child with no placement_history yet (shouldn't happen post-
// onboarding, but defensively) is treated as not-due: onboarding placement, not
// a reprobe, is the right activity for that state.
router.get('/:child_id/reprobe-due', requireAuth, requireChildOwner, async (req, res) => {
  const childId = req.params.child_id as string
  const last = await queryOne<{ taken_at: string }>(
    `select taken_at from placement_history where child_id = $1 order by taken_at desc limit 1`,
    [childId]
  )
  if (!last) { res.json({ data: { due: false, next_eligible_at: null }, error: null }); return }

  const config = reprobeConfig()
  const lastPlacementAt = new Date(last.taken_at)
  const due = isReprobeDue(lastPlacementAt, new Date(), childId, config)
  res.json({
    data: { due, next_eligible_at: nextEligibleAt(lastPlacementAt, childId, config).toISOString() },
    error: null,
  })
})

// ── POST /api/placement/:child_id/reprobe-result ──────────
// Same probe, same answer shape as onboarding (resultsSchema) — but this is a
// PRIOR refresh, not a gate write (design doc §3). V/D/F get only their
// prior_level (and confidence) updated; the damped recompute (promoteStrands)
// blends it in exactly like any lesson/story completion would. C has no
// recompute loop of its own, so it's written directly — same as onboarding.
router.post('/:child_id/reprobe-result', requireAuth, requireChildOwner, async (req, res) => {
  const parsed = resultsSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ data: null, error: parsed.error.message }); return }
  const results = parsed.data as ProbeResults
  const childId = req.params.child_id as string
  const userId = res.locals.userId
  const { level, strands, confidence } = scoreProbe(results, probeK())

  const [child] = await query(
    `update children set level = $1 where id = $2 and parent_id = $3 returning id`,
    [level, childId, userId]
  )
  if (!child) { res.status(404).json({ data: null, error: 'Child not found' }); return }

  for (const [strand, lvl] of Object.entries(strands)) {
    const conf = confidence[strand as keyof typeof confidence]
    if (strand === 'C') {
      // Placement-only strand — never earned, never recomputed. Re-placement
      // is its only update mechanism, same as onboarding.
      await query(
        `insert into child_strand_levels (child_id, strand, level, prior_level, confidence, source, updated_at)
         values ($1, $2, $3, $3, $4, 'placement', now())
         on conflict (child_id, strand) do update
           set level = excluded.level, prior_level = excluded.prior_level,
               confidence = excluded.confidence, source = 'placement', updated_at = now()`,
        [childId, strand, lvl, conf]
      )
      continue
    }
    // V/D/F: refresh the PRIOR (and its confidence) only. level/source stay
    // whatever the last recompute set them to — promoteStrands below blends
    // this prior in through the same damped, idempotent pipeline as any
    // other trigger. The INSERT branch (level seeded to the same value) only
    // fires if this strand somehow has no row yet — shouldn't happen post-
    // onboarding, but if it does, treating it as a fresh placement is the
    // reasonable fallback.
    await query(
      `insert into child_strand_levels (child_id, strand, level, prior_level, confidence, source, updated_at)
       values ($1, $2, $3, $3, $4, 'placement', now())
       on conflict (child_id, strand) do update
         set prior_level = excluded.prior_level, confidence = excluded.confidence, updated_at = now()`,
      [childId, strand, lvl, conf]
    )
  }

  // Append the snapshot (kind='reprobe' — see design doc §3) before recompute,
  // so the trajectory log always has the prior that produced a given move.
  await query(
    `insert into placement_history (child_id, level, strand_levels, kind) values ($1, $2, $3, 'reprobe')`,
    [childId, level, JSON.stringify(strands)]
  )

  const promotions = await promoteStrands(childId, 'reprobe')
  res.json({ data: { promotions }, error: null })
})

export default router
