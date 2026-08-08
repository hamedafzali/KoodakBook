import {
  isLessonUnlocked,
  isStoryUnlocked,
  lessonStrand,
  type StrandLevels,
  type Promotion,
} from '@koodakbook/shared'

/* Pure strand-promotion decision (§11.1) — no DB, no imports beyond the shared
 * gating helpers, so it is unit-testable without a database (promotion.test.ts).
 * strands.ts does the DB fetch/persist and delegates the algorithm here. */

// Strands that gate content and can therefore be earned by completing it.
export const EARNABLE = ['V', 'D', 'F'] as const
export const THRESHOLD = 0.85
export const MAX_LEVEL = 4

export interface PromotionContent {
  lessons: { id: string; type: string; stage: number }[]
  stories: { id: string; stage: number }[]
  doneLessons: ReadonlySet<string>
  doneStories: ReadonlySet<string>
}

/**
 * Given a child's current per-strand levels and the content they've completed,
 * return the new levels + the promotions applied.
 *
 * Rule: for each earnable strand, while below the cap, promote one level
 * whenever ≥ ceil(85%) of the currently-unlocked content is done — but stop once
 * a promotion would unlock no further content, so within a single call thin
 * content does not sprint to the cap.
 */
export function computePromotionLevels(
  levels: StrandLevels,
  content: PromotionContent,
): { levels: StrandLevels; promotions: Promotion[] } {
  const next: StrandLevels = { ...levels }

  const unlockedIds = (strand: typeof EARNABLE[number], lv: StrandLevels): string[] =>
    strand === 'F'
      ? content.stories.filter(s => isStoryUnlocked(s, lv)).map(s => s.id)
      : content.lessons.filter(l => lessonStrand(l.type) === strand && isLessonUnlocked(l, lv)).map(l => l.id)

  for (const strand of EARNABLE) {
    while (next[strand] < MAX_LEVEL) {
      const unlocked = unlockedIds(strand, next)
      if (unlocked.length === 0) break
      const done = unlocked.filter(id => (strand === 'F' ? content.doneStories : content.doneLessons).has(id)).length
      if (done < Math.ceil(THRESHOLD * unlocked.length)) break
      // Promote — but only keep climbing if the next stage actually adds content.
      const trial: StrandLevels = { ...next, [strand]: next[strand] + 1 }
      next[strand]++
      if (unlockedIds(strand, trial).length <= unlocked.length) break
    }
  }

  const promotions: Promotion[] = []
  for (const strand of EARNABLE) {
    if (next[strand] > levels[strand]) promotions.push({ strand, from: levels[strand], to: next[strand] })
  }
  return { levels: next, promotions }
}
