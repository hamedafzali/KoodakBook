import { query, queryOne } from './db'
import type { Promotion } from '@koodakbook/shared'
import {
  recomputeGates, promotionsFrom,
  EARNABLE, DEFAULT_PRIOR_K, DEFAULT_MASTERY_THRESHOLD, DEFAULT_MAX_DOWN_PER_RECOMPUTE,
  type GateConfig, type GateContent, type GateInput, type EarnableStrand, type GateResult,
} from './gate'

/**
 * Gate recompute (docs/placement-progression-rebuild.md). Runs after a lesson or
 * story completion. Unlike the old promoteStrands it does NOT ratchet: the gate is
 * recomputed from mastery evidence + a decaying placement prior, so unchanged
 * evidence leaves the gate untouched (BUG-C fixed) and the gate is free to move
 * DOWN as well as up (decision ii, damped — §6.4). All DB access lives here; the
 * decision logic is the pure gate.ts module.
 *
 * Returns UPWARD gate moves only, as content-unlock events. Downward moves are
 * silent (the client shows no level number — the trophy is XP, §1).
 */
export async function promoteStrands(childId: string, trigger = 'lesson'): Promise<Promotion[]> {
  try {
    return await recomputeChildGates(childId, trigger)
  } catch (err) {
    // A recompute bug must never break the child's completion flow — the lesson is
    // already recorded by the caller. Degrade to "no change this time".
    console.error('promoteStrands failed for', childId, err)
    return []
  }
}

// Runtime-configurable knobs (§3.3 / §6.3) — read from env so a pilot can tune
// them without a release. Every default is an unvalidated assumption (design §7).
function gateConfig(): GateConfig {
  const num = (v: string | undefined, d: number) => {
    const n = v === undefined ? NaN : Number(v)
    return Number.isFinite(n) ? n : d
  }
  return {
    k: num(process.env.PROGRESSION_PRIOR_K, DEFAULT_PRIOR_K),
    masteryThreshold: num(process.env.PROGRESSION_MASTERY_THRESHOLD, DEFAULT_MASTERY_THRESHOLD),
    maxDownPerRecompute: num(process.env.PROGRESSION_MAX_DOWN_PER_RECOMPUTE, DEFAULT_MAX_DOWN_PER_RECOMPUTE),
  }
}

/**
 * How the decaying placement PRIOR is sourced:
 *   • 'stored'    — production: the retained prior_level column (migration 048).
 *   • 'placement' — measurement-only: derive it in-query exactly as 048's backfill
 *                   does (earliest placement_history snapshot, else current level),
 *                   against tables that already exist PRE-migration. This lets the
 *                   blast-radius script model the POST-migration baseline on
 *                   current prod WITHOUT reading the not-yet-added prior_level
 *                   column. The numbers it yields are the migrated baseline's, not
 *                   prod-as-it-stands-today's.
 */
export type PriorMode = 'stored' | 'placement'

/**
 * READ-ONLY: gather a child's evidence + prior and run the recompute, WITHOUT
 * persisting or logging. This is the exact computation recomputeChildGates
 * applies — factored out so the blast-radius script (scripts/gateBlastRadius.ts)
 * measures precisely what a live recompute would do, with no risk of divergence
 * and no writes. Returns null if the child does not exist.
 */
export async function computeGateResults(
  childId: string,
  priorMode: PriorMode = 'stored',
): Promise<GateResult[] | null> {
  const child = await queryOne<{ level: number }>('select level from children where id = $1', [childId])
  if (!child) return null
  const config = gateConfig()

  // Current per-strand rows: level = the stored gate (previousGate). Missing
  // strand → previousGate null and the prior falls back to children.level.
  const rows = await query<{ strand: string; level: number }>(
    'select strand, level from child_strand_levels where child_id = $1', [childId]
  )
  const rowByStrand = new Map(rows.map(r => [r.strand, r]))
  const priorByStrand = await loadPriors(childId, priorMode)

  const content = await loadEvidence(childId, config.masteryThreshold)
  const n = await interactionCounts(childId)

  const inputs = {} as Record<EarnableStrand, GateInput>
  for (const strand of EARNABLE) {
    const row = rowByStrand.get(strand)
    inputs[strand] = {
      prior: priorByStrand.get(strand) ?? row?.level ?? child.level,
      previousGate: row ? row.level : null,
      n: n[strand],
    }
  }

  return recomputeGates(inputs, content, config)
}

// Prior resolution per strand — see PriorMode. 'placement' mirrors migration 048's
// backfill so the measurement equals what 048 would install; the coalesce-to-
// current-level fallback lives at the call site (priorByStrand.get ?? row.level).
async function loadPriors(childId: string, mode: PriorMode): Promise<Map<string, number>> {
  if (mode === 'stored') {
    const rows = await query<{ strand: string; prior_level: number | null }>(
      'select strand, prior_level from child_strand_levels where child_id = $1', [childId]
    )
    return new Map(rows.filter(r => r.prior_level != null).map(r => [r.strand, r.prior_level as number]))
  }
  // 'placement': earliest placement_history snapshot per strand — identical to the
  // 048 backfill's `(ph.strand_levels ->> strand)::int order by ph.taken_at asc`.
  const rows = await query<{ strand: string; prior: number | null }>(
    `select s.strand,
            (select (ph.strand_levels ->> s.strand)::int
               from placement_history ph
              where ph.child_id = $1 and ph.strand_levels ? s.strand
              order by ph.taken_at asc
              limit 1) as prior
       from (values ('V'), ('D'), ('F')) as s(strand)`,
    [childId]
  )
  return new Map(rows.filter(r => r.prior != null).map(r => [r.strand, r.prior as number]))
}

async function recomputeChildGates(childId: string, trigger: string): Promise<Promotion[]> {
  const results = await computeGateResults(childId)
  if (!results) return []
  await persistGates(childId, results)
  await logRecompute(childId, results, trigger)
  return promotionsFrom(results)
}

// ── Evidence: which content is MASTERED (not merely completed — §6.1) ─────────
// A lesson is mastered when it is completed AND ≥threshold of its WORD items are
// receptively mastered. A letter-only lesson (alphabet/phonics — D strand) has no
// word-level mastery signal, so completion is the best available evidence and it
// falls back to that. A story is mastered when completed AND ≥threshold of its
// target words are mastered.
async function loadEvidence(childId: string, threshold: number): Promise<GateContent> {
  const lessons = await query<{ id: string; type: string; stage: number }>(
    'select id, type, stage from lessons'
  )
  const stories = await query<{ id: string; stage: number }>(
    'select id, stage from stories where not ai_generated'
  )

  const masteredLessonRows = await query<{ id: string }>(
    `select l.id
       from lessons l
       join child_lesson_progress clp
         on clp.lesson_id = l.id and clp.child_id = $1 and clp.completed
       left join lesson_items li
         on li.lesson_id = l.id and li.item_type = 'word'
       left join child_word_progress cwp
         on cwp.word_id = li.word_id and cwp.child_id = $1
        and cwp.mastery in ('mastered', 'consolidated')
      group by l.id
     having count(li.id) = 0
         or count(cwp.id) >= ceil($2::numeric * count(li.id))`,
    [childId, threshold]
  )

  const masteredStoryRows = await query<{ id: string }>(
    `select s.id
       from stories s
       join child_story_progress csp
         on csp.story_id = s.id and csp.child_id = $1 and csp.completed
       left join story_pages sp on sp.story_id = s.id
       left join story_page_words spw on spw.page_id = sp.id
       left join child_word_progress cwp
         on cwp.word_id = spw.word_id and cwp.child_id = $1
        and cwp.mastery in ('mastered', 'consolidated')
      group by s.id
     having count(distinct spw.word_id) = 0
         or count(distinct cwp.word_id) >= ceil($2::numeric * count(distinct spw.word_id))`,
    [childId, threshold]
  )

  return {
    lessons,
    stories,
    masteredLessons: new Set(masteredLessonRows.map(r => r.id)),
    masteredStories: new Set(masteredStoryRows.map(r => r.id)),
  }
}

// ── n: how much real evidence exists per strand, to decay the prior (§3) ──────
// V/F use word-rep breadth (distinct words practised in that strand's content);
// D has no word signal (letters aren't SR-tracked), so it uses completed D-lesson
// count — necessarily coarser. n's exact definition is itself a tuning knob (§7).
async function interactionCounts(childId: string): Promise<Record<EarnableStrand, number>> {
  const one = async (sql: string) =>
    (await queryOne<{ n: string }>(sql, [childId]))?.n ?? '0'

  const [v, d, f] = await Promise.all([
    one(`select count(*)::int as n from child_word_progress cwp
          where cwp.child_id = $1 and cwp.word_id in (
            select li.word_id from lesson_items li
            join lessons l on l.id = li.lesson_id and l.type = 'vocabulary'
            where li.item_type = 'word')`),
    one(`select count(*)::int as n from child_lesson_progress clp
          join lessons l on l.id = clp.lesson_id and l.type in ('alphabet', 'phonics')
          where clp.child_id = $1 and clp.completed`),
    one(`select count(*)::int as n from child_word_progress cwp
          where cwp.child_id = $1 and cwp.word_id in (
            select spw.word_id from story_page_words spw)`),
  ])
  return { V: Number(v), D: Number(d), F: Number(f) }
}

async function persistGates(childId: string, results: GateResult[]): Promise<void> {
  for (const r of results) {
    await query(
      `insert into child_strand_levels (child_id, strand, level, prior_level, confidence, source, updated_at)
       values ($1, $2, $3, $4, $5, 'auto', now())
       on conflict (child_id, strand) do update
         set level = excluded.level, confidence = excluded.confidence,
             source = 'auto', updated_at = now()`,
      // prior_level is only set on first insert; on conflict it is intentionally
      // preserved (the prior belongs to placement/migration, not recompute).
      [childId, r.strand, r.gateAfter, r.prior, 1 - r.w]
    )
  }
}

async function logRecompute(childId: string, results: GateResult[], trigger: string): Promise<void> {
  for (const r of results) {
    await query(
      `insert into gate_recompute_log
         (child_id, strand, n, prior, demonstrated, w, k, gate_before, gate_after, damped, trigger)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [childId, r.strand, r.n, r.prior, r.demonstrated, r.w, r.k, r.gateBefore, r.gateAfter, r.damped, trigger]
    )
  }
}
