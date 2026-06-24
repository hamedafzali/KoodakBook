import { query, queryOne } from './db'
import {
  isLessonUnlocked,
  isStoryUnlocked,
  lessonStrand,
  type StrandLevels,
  type Promotion,
} from '@koodakbook/shared'

const ALL_STRANDS = ['P', 'D', 'V', 'F', 'C'] as const
// Strands that gate content and can therefore be earned by completing it.
const EARNABLE = ['V', 'D', 'F'] as const
const THRESHOLD = 0.85

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
  const before = { ...levels }

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

  // Content unlocked for a strand at a hypothetical set of levels.
  const unlockedIds = (strand: typeof EARNABLE[number], lv: StrandLevels): string[] =>
    strand === 'F'
      ? stories.filter(s => isStoryUnlocked(s, lv)).map(s => s.id)
      : lessons.filter(l => lessonStrand(l.type) === strand && isLessonUnlocked(l, lv)).map(l => l.id)

  for (const strand of EARNABLE) {
    while (levels[strand] < 4) {
      const unlocked = unlockedIds(strand, levels)
      if (unlocked.length === 0) break
      const done = unlocked.filter(id => (strand === 'F' ? doneStories : doneLessons).has(id)).length
      if (done < Math.ceil(THRESHOLD * unlocked.length)) break
      // Promote — but only keep climbing if the next stage actually adds content,
      // so thin content settles at "cleared everything available" instead of 4.
      const trial: StrandLevels = { ...levels, [strand]: levels[strand] + 1 }
      levels[strand]++
      if (unlockedIds(strand, trial).length <= unlocked.length) break
    }
  }

  const promotions: Promotion[] = []
  for (const strand of EARNABLE) {
    if (levels[strand] > before[strand]) {
      await query(
        `insert into child_strand_levels (child_id, strand, level, source, updated_at)
         values ($1, $2, $3, 'auto', now())
         on conflict (child_id, strand) do update
           set level = excluded.level, source = 'auto', updated_at = now()`,
        [childId, strand, levels[strand]]
      )
      promotions.push({ strand, from: before[strand], to: levels[strand] })
    }
  }
  return promotions
}
