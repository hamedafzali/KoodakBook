import { query, queryOne } from './db'
import type { StrandLevels, Promotion } from '@koodakbook/shared'
import { computePromotionLevels } from './promotion'

const ALL_STRANDS = ['P', 'D', 'V', 'F', 'C'] as const

/**
 * Progression loop (project.md §11.1): when a child has completed ≥85% of the
 * content currently UNLOCKED for a strand, raise that strand one level — which
 * opens the next stage. Called after a lesson/story completion. Idempotent;
 * only ever raises levels (placement is the floor) and caps at 4.
 *
 * Convergence: raising a level unlocks the next stage's content, which is not
 * yet completed, so the ratio drops below threshold and the loop stops — unless
 * a strand has no higher content, in which case it settles at the cap.
 */
export async function promoteStrands(childId: string): Promise<Promotion[]> {
  try {
    return await computePromotions(childId)
  } catch (err) {
    // A promotion bug must never break the child's completion flow — the lesson
    // is already recorded by the caller. Degrade to "no promotion this time".
    console.error('promoteStrands failed for', childId, err)
    return []
  }
}

async function computePromotions(childId: string): Promise<Promotion[]> {
  const child = await queryOne<{ level: number }>('select level from children where id = $1', [childId])
  if (!child) return []

  const rows = await query<{ strand: string; level: number }>(
    'select strand, level from child_strand_levels where child_id = $1', [childId]
  )
  const levels = {} as StrandLevels
  for (const s of ALL_STRANDS) levels[s] = child.level
  for (const r of rows) levels[r.strand as keyof StrandLevels] = r.level

  const lessons = await query<{ id: string; type: string; stage: number }>('select id, type, stage from lessons')
  const stories = await query<{ id: string; stage: number }>('select id, stage from stories where not ai_generated')
  const doneLessons = new Set(
    (await query<{ lesson_id: string }>('select lesson_id from child_lesson_progress where child_id = $1 and completed', [childId]))
      .map(r => r.lesson_id)
  )
  const doneStories = new Set(
    (await query<{ story_id: string }>('select story_id from child_story_progress where child_id = $1 and completed', [childId]))
      .map(r => r.story_id)
  )

  const { promotions } = computePromotionLevels(levels, { lessons, stories, doneLessons, doneStories })

  for (const { strand, to } of promotions) {
    await query(
      `insert into child_strand_levels (child_id, strand, level, source, updated_at)
       values ($1, $2, $3, 'auto', now())
       on conflict (child_id, strand) do update
         set level = excluded.level, source = 'auto', updated_at = now()`,
      [childId, strand, to]
    )
  }
  return promotions
}
