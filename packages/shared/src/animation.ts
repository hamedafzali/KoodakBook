/* ── Animation template registry (Phase 0) ──────────────────────────────────
 *
 * Animations are DATA, not code: every content row stores which reusable
 * template renders it (`animation_template`) plus typed parameters
 * (`animation_params`). ~12 templates cover all ~190 words + letters + badges,
 * so adding content never means writing a new animation — only a new row.
 *
 * This file is the ONE source of truth, shared by:
 *   • the admin panel (authoring form: which params a template takes)
 *   • the runtime renderer (which engine/component to mount)
 *   • the future generation engine's validator (final phase)
 *
 * Dependency-free on purpose (no zod) — the shared package is consumed by the
 * web + admin Next apps and the Express backend, and stays light. The backend
 * generator can build a zod schema from this registry; everyone else uses the
 * plain `validateAnimationParams()` helper below.
 *
 * Hard rules baked in (see the product spec): motion is tap-gated (never
 * autoplay), rewards are one-shot (no endless loops), and duration is capped by
 * the child's age band (3–5 → 1.5s, 6–8 → 3s). Abstract function words (the
 * `questions` category) are deliberately NOT animated — they use `none`.
 */

import type { WordCategory } from './types'

// ── Templates & engines ─────────────────────────────────────
export const ANIMATION_TEMPLATES = [
  'object_reaction', // animals/food/objects/clothes/school/body/greetings — tap → squash/pop + audio
  'creature',        // animals — object_reaction + blink/tail/sound
  'verb',            // actions/transportation — subject performs the verb once
  'color',           // colors — swatch floods with the color
  'number',          // numbers — items appear one by one, counted aloud
  'shape',           // shapes — stroke reveals the outline
  'letter',          // alphabet — RTL stroke order + glow, name then example word
  'emotion',         // feelings — face morphs to the emotion
  'spatial',         // prepositions — target object moves into the relation
  'weather',         // weather (+ sun/rain/snow nature words) — sky state changes
  'opposite_pair',   // opposites — tap toggles A ↔ B with a morph
  'reward',          // badges / lesson-complete — one-shot celebration
  'none',            // abstract words (questions) — static card + audio, no motion
] as const

export type AnimationTemplate = (typeof ANIMATION_TEMPLATES)[number]

export const ANIMATION_ENGINES = ['rive', 'lottie', 'css', 'threejs'] as const
export type AnimationEngine = (typeof ANIMATION_ENGINES)[number]

// ── Age → max animation duration (ms) ───────────────────────
// 3–5 year olds: ≤1.5s. 6–8: ≤3s. Keyed off the content's lower age bound.
export const AGE_DURATION_CAP_MS = { younger: 1500, older: 3000 } as const

/** Max allowed animation duration for a child age (defaults to the strict cap). */
export function durationCapMsForAge(ageMin: number | null | undefined): number {
  return ageMin != null && ageMin >= 6 ? AGE_DURATION_CAP_MS.older : AGE_DURATION_CAP_MS.younger
}

// ── Default template per word category ──────────────────────
// The generator (or a human) may override per word, but this is the sensible
// default the authoring form pre-selects.
export const CATEGORY_TEMPLATE: Record<WordCategory, AnimationTemplate> = {
  animals: 'creature',
  colors: 'color',
  family: 'object_reaction',
  food: 'object_reaction',
  body: 'object_reaction',
  nature: 'object_reaction',
  objects: 'object_reaction',
  numbers: 'number',
  shapes: 'shape',
  feelings: 'emotion',
  actions: 'verb',
  greetings: 'object_reaction',
  clothes: 'object_reaction',
  transportation: 'verb',
  weather: 'weather',
  school: 'object_reaction',
  opposites: 'opposite_pair',
  questions: 'none',
  prepositions: 'spatial',
}

export function templateForCategory(category: WordCategory): AnimationTemplate {
  return CATEGORY_TEMPLATE[category] ?? 'object_reaction'
}

// ── Per-template parameter shapes ───────────────────────────
// Common fields every animated template may set. `loop` must stay false for
// word tiles — endless motion is a hard no.
export interface BaseParams {
  engine?: AnimationEngine
  duration_ms?: number
  loop?: false
  /** Asset id for the isolated SVG/Rive artwork (filled by the art pipeline). */
  svg_id?: string
  /** Word/letter audio id; tapping always replays it (the repetition loop). */
  audio_id?: string
}

export interface ObjectReactionParams extends BaseParams {
  tap_beat?: 'pop' | 'open' | 'wave' | 'bite'
  squash?: number
}
export interface CreatureParams extends ObjectReactionParams {
  blink_speed_ms?: number
  tail_swish?: boolean
  signature_sound?: string
  jump?: boolean
}
export interface VerbParams extends BaseParams {
  move_distance_pct?: number
  repeat_count?: number
  path?: 'linear' | 'arc'
}
export interface ColorParams extends BaseParams {
  hex?: string
  fill_sweep?: 'left-to-right' | 'radial'
  swatch_object?: 'balloon' | 'paint'
}
export interface NumberParams extends BaseParams {
  count_to?: number
  item_glyph?: string
  stagger_ms?: number
}
export interface ShapeParams extends BaseParams {
  stroke_reveal_ms?: number
  glow?: boolean
}
export interface LetterParams extends BaseParams {
  glow?: boolean
  diacritic_overlay?: 'none' | 'zabar' | 'zir' | 'pish'
  name_audio_id?: string
  example_word_audio_id?: string
}
export interface EmotionParams extends BaseParams {
  face?: 'happy' | 'sad' | 'angry' | 'tired' | 'scared'
  bounce?: number
  hold_ms?: number
}
export interface SpatialParams extends BaseParams {
  reference_object?: string
  target_object?: string
  relation?: 'on' | 'under' | 'inside' | 'beside' | 'behind' | 'front' | 'outside'
}
export interface WeatherParams extends BaseParams {
  sky_state?: 'sunny' | 'rainy' | 'cloudy' | 'snowy'
  element?: 'rain' | 'snow' | 'none'
  density?: 'low'
}
export interface OppositePairParams extends BaseParams {
  state_a?: string
  state_b?: string
  morph_ms?: number
}
export interface RewardParams extends BaseParams {
  icon_id?: string
  praise_audio_id?: string
  sparkle?: 'single'
}
/** `none`: static card + audio, no motion params. */
export type NoneParams = Pick<BaseParams, 'svg_id' | 'audio_id'>

export type AnimationParams =
  | ObjectReactionParams | CreatureParams | VerbParams | ColorParams
  | NumberParams | ShapeParams | LetterParams | EmotionParams
  | SpatialParams | WeatherParams | OppositePairParams | RewardParams | NoneParams

// ── Registry metadata (drives the admin authoring form) ─────
export interface TemplateSpec {
  engine: AnimationEngine
  /** Param keys the authoring form should expose for this template. */
  params: string[]
  /** Renders motion at all (false → static card, e.g. `none`). */
  animated: boolean
}

export const TEMPLATE_REGISTRY: Record<AnimationTemplate, TemplateSpec> = {
  object_reaction: { engine: 'rive',   animated: true,  params: ['svg_id', 'audio_id', 'tap_beat', 'squash', 'duration_ms'] },
  creature:        { engine: 'rive',   animated: true,  params: ['svg_id', 'audio_id', 'tap_beat', 'blink_speed_ms', 'tail_swish', 'signature_sound', 'jump', 'duration_ms'] },
  verb:            { engine: 'rive',   animated: true,  params: ['svg_id', 'audio_id', 'move_distance_pct', 'repeat_count', 'path', 'duration_ms'] },
  color:           { engine: 'rive',   animated: true,  params: ['audio_id', 'hex', 'fill_sweep', 'swatch_object', 'duration_ms'] },
  number:          { engine: 'rive',   animated: true,  params: ['audio_id', 'count_to', 'item_glyph', 'stagger_ms', 'duration_ms'] },
  shape:           { engine: 'lottie', animated: true,  params: ['audio_id', 'stroke_reveal_ms', 'glow', 'duration_ms'] },
  letter:          { engine: 'lottie', animated: true,  params: ['glow', 'diacritic_overlay', 'name_audio_id', 'example_word_audio_id', 'duration_ms'] },
  emotion:         { engine: 'rive',   animated: true,  params: ['svg_id', 'audio_id', 'face', 'bounce', 'hold_ms', 'duration_ms'] },
  spatial:         { engine: 'rive',   animated: true,  params: ['audio_id', 'reference_object', 'target_object', 'relation', 'duration_ms'] },
  weather:         { engine: 'rive',   animated: true,  params: ['audio_id', 'sky_state', 'element', 'density', 'duration_ms'] },
  opposite_pair:   { engine: 'rive',   animated: true,  params: ['audio_id', 'state_a', 'state_b', 'morph_ms', 'duration_ms'] },
  reward:          { engine: 'lottie', animated: true,  params: ['icon_id', 'praise_audio_id', 'sparkle', 'duration_ms'] },
  none:            { engine: 'css',    animated: false, params: ['svg_id', 'audio_id'] },
}

// ── Story scene plans ───────────────────────────────────────
export interface ScenePage {
  /** Scene-library slug (see scenes.ts) — picks the page's backdrop. */
  scene?: string
  /** Backdrop time of day. */
  time?: 'day' | 'night'
  focus_word?: string
  motion?: string
  interaction?: string
  voice_cue?: string
  completion_trigger?: string
}
export type ScenePlan = ScenePage

// ── Image brief (handed to the art pipeline) ────────────────
export interface ImageBrief {
  subject: string
  composition?: string
  background?: string
  cultural_notes?: string
  avoid?: string[]
  consistency_notes?: string
}

// ── Validation (dependency-free; mirrors the hard rules) ────
export type AnimationReview = 'pending' | 'approved' | 'rejected' | 'none'

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Validate a template + params pair against the registry and the hard rules.
 * Numeric range checks (duration cap) live here, not in JSON Schema — the API's
 * structured-output schema can't express min/max, so the generator validates
 * with this after parsing.
 */
export function validateAnimationParams(
  template: string,
  params: AnimationParams | Record<string, unknown> | null | undefined,
  opts: { ageMin?: number | null } = {},
): ValidationResult {
  const errors: string[] = []

  if (!ANIMATION_TEMPLATES.includes(template as AnimationTemplate)) {
    return { ok: false, errors: [`unknown template "${template}"`] }
  }
  const t = template as AnimationTemplate
  const spec = TEMPLATE_REGISTRY[t]
  const p = (params ?? {}) as Record<string, unknown>

  if (!spec.animated) {
    // `none` is a static card — must not carry motion params.
    if ('duration_ms' in p || p.loop === true) {
      errors.push(`template "${t}" is not animated; remove motion params`)
    }
    return { ok: errors.length === 0, errors }
  }

  if (p.loop === true) errors.push('loop must be false — endless motion is not allowed')

  if (typeof p.duration_ms === 'number') {
    const cap = durationCapMsForAge(opts.ageMin)
    if (p.duration_ms > cap) {
      errors.push(`duration_ms ${p.duration_ms} exceeds the ${cap}ms cap for this age band`)
    }
    if (p.duration_ms <= 0) errors.push('duration_ms must be positive')
  }

  if (p.engine != null && !ANIMATION_ENGINES.includes(p.engine as AnimationEngine)) {
    errors.push(`unknown engine "${String(p.engine)}"`)
  }

  if (t === 'spatial' && p.relation == null) {
    errors.push('spatial template requires a "relation"')
  }

  return { ok: errors.length === 0, errors }
}
