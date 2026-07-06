/* ── Scene library registry ─────────────────────────────────
 *
 * Story backgrounds are a fixed, curated library — NOT per-page generated
 * images (character/style consistency + review burden). The AI story generator
 * emits one `scene` slug + `time` per page (validated against this list); the
 * player renders the matching layered backdrop with a slow Ken Burns drift.
 * One source of truth for: the generator's validator, the admin authoring
 * form, and the web renderer.
 */

export const SCENE_SLUGS = [
  'forest',   // جنگل
  'home',     // خانه (نمای بیرونی)
  'room',     // اتاق کودک
  'school',   // مدرسه
  'park',     // پارک
  'sea',      // دریا
  'mountain', // کوه
  'bazaar',   // بازار
  'kitchen',  // آشپزخانه
  'garden',   // حیاط و باغچه
  'city',     // شهر
  'sky',      // آسمان (پرواز/رؤیا)
] as const

export type SceneSlug = (typeof SCENE_SLUGS)[number]
export type SceneTime = 'day' | 'night'

export const SCENE_LABELS: Record<SceneSlug, string> = {
  forest: 'جنگل', home: 'خانه', room: 'اتاق', school: 'مدرسه',
  park: 'پارک', sea: 'دریا', mountain: 'کوه', bazaar: 'بازار',
  kitchen: 'آشپزخانه', garden: 'حیاط', city: 'شهر', sky: 'آسمان',
}

export function isSceneSlug(s: unknown): s is SceneSlug {
  return typeof s === 'string' && (SCENE_SLUGS as readonly string[]).includes(s)
}

/** Normalize a generator-emitted scene reference; anything unknown → null so
 *  the player falls back to the previous page's scene. */
export function parseSceneRef(scene: unknown, time: unknown): { scene: SceneSlug; time: SceneTime } | null {
  if (!isSceneSlug(scene)) return null
  return { scene, time: time === 'night' ? 'night' : 'day' }
}
