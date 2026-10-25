import type { LessonType } from '@koodakbook/shared'

/**
 * Order of lesson types wherever the app shows them as a sequence: the lesson
 * list's sections (app/lessons.tsx) and Home's learning path (app/home.tsx).
 * One constant, so the two can never disagree.
 *
 * PROVISIONAL (2026-09-24, owner-approved as a placeholder): nothing in the
 * repo or project docs defines a teaching order for lesson types, so this is
 * the declaration order of the shared LESSON_TYPE_LABEL / LESSON_TYPE_EMOJI
 * constants. Change it here, and only here, once the real order is decided.
 *
 * The API's own order (`order by stage, order_index`) is deliberately not
 * used: it interleaves the types, so "whichever type comes first" would
 * shift with seed data instead of being a decision.
 */
export const LESSON_SECTION_ORDER: readonly LessonType[] = ['vocabulary', 'alphabet', 'phonics']
