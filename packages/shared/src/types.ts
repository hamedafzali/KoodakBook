import type { AnimationTemplate, AnimationParams, ImageBrief, ScenePlan, AnimationReview } from './animation'

// ── Auth ──────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  created_at: string
}

// ── Child ─────────────────────────────────────────────────
export interface Child {
  id: string
  parent_id: string
  name: string
  birth_year: number | null
  level: 1 | 2 | 3 | 4
  avatar_url: string | null
  created_at: string
  /** Set once the placement probe has run (mig-020). */
  placement_done?: boolean
}

// ── Placement probe (mig-020) ─────────────────────────────
export type Strand = 'P' | 'D' | 'V' | 'F' | 'C'

export interface ProbeChoice {
  id: string
  kind: 'word' | 'letter'
  persian: string
  english?: string
  character?: string
}
export interface ProbeQuestion {
  strand: Strand
  stage: number
  mode: 'listen' | 'read'
  prompt: string
  audio_url?: string | null
  show_text?: string | null
  choices: ProbeChoice[]
  correct_id: string
}
export interface PlacementProbe {
  questions: ProbeQuestion[]
}

/** A strand level-up earned by clearing unlocked content (progress-driven). */
export interface Promotion {
  strand: Strand
  from: number
  to: number
}

export type CreateChildInput = Pick<Child, 'name' | 'birth_year' | 'level' | 'avatar_url'>

// ── Audio (per-section TTS voices) ─────────────────────────
export type AudioSection = 'story' | 'letter' | 'word' | 'phonics' | 'math'
/** piper/edge run on the free sidecar; the rest are keyed cloud engines. */
export type AudioEngine = 'piper' | 'edge' | 'azure' | 'openai' | 'google' | 'elevenlabs'

export interface AudioSectionConfig {
  section: AudioSection
  engine: AudioEngine
  voice: string
  /** Optional paid tier (cloud engines only); null = premium hears the free voice. */
  premium_engine?: AudioEngine | null
  premium_voice?: string | null
}

// ── Content ───────────────────────────────────────────────
export interface Word {
  id: string
  persian: string
  english: string
  finglish: string | null
  category: WordCategory
  stage: number
  /** Diacritized pronunciation override used only for TTS (homographs). */
  tts_text?: string | null
  audio_url: string | null
  audio_url_premium?: string | null
  image_url: string | null
  // ── Animation (Phase 0) ──
  animation_template?: AnimationTemplate | null
  animation_params?: AnimationParams
  image_brief?: ImageBrief | null
  animation_review?: AnimationReview
  animation_engine_version?: number | null
  animation_model?: string | null
}

export type WordCategory =
  | 'animals' | 'colors' | 'family' | 'food' | 'body' | 'nature' | 'objects'
  | 'numbers' | 'shapes' | 'feelings' | 'actions' | 'greetings'
  | 'clothes' | 'transportation' | 'weather' | 'school'
  | 'opposites' | 'questions' | 'prepositions'

export interface Letter {
  id: string
  character: string
  name_persian: string
  name_english: string
  group: number
  order_in_group: number
  /** Diacritized pronunciation override used only for TTS (letter names). */
  tts_text?: string | null
  audio_url: string | null
  audio_url_premium?: string | null
  example_word_id: string | null
  animation_template?: AnimationTemplate | null
  animation_params?: AnimationParams
}

export interface Lesson {
  id: string
  title: string
  type: LessonType
  stage: number
  order_index: number
  description: string | null
  thumbnail_url: string | null
}

export type LessonType = 'vocabulary' | 'alphabet' | 'phonics'

export interface LessonItem {
  id: string
  lesson_id: string
  item_type: 'word' | 'letter'
  word_id: string | null
  letter_id: string | null
  order_index: number
  word?: Word
  letter?: Letter
}

export interface Story {
  id: string
  title_persian: string
  title_english: string
  stage: number
  age_min: number | null
  age_max: number | null
  cover_url: string | null
  pdf_url: string | null
  audio_url: string | null
  created_at: string
}

export interface StoryPage {
  id: string
  story_id: string
  page_number: number
  text_persian: string
  text_english: string | null
  image_url: string | null
  audio_url: string | null
  audio_url_premium?: string | null
  scene_plan?: ScenePlan | null
  animation_review?: AnimationReview
  animation_engine_version?: number | null
  animation_model?: string | null
}

export interface StoryPageWord {
  id: string
  page_id: string
  word_id: string
  position: number
  word?: Word
}

// ── Progress ──────────────────────────────────────────────
export type WordStatus = 'introduced' | 'practiced' | 'mastered'

/**
 * Mastery state machine (mig-016). Supersedes the 3-state legacy `status`:
 * introduced → practicing → mastered → consolidated. Productive recall (speak)
 * enriches mastery but never gates it. See project.md §11.1.
 */
export type WordMastery = 'introduced' | 'practicing' | 'mastered' | 'consolidated'

export interface ChildWordProgress {
  id: string
  child_id: string
  word_id: string
  status: WordStatus
  /** New 4-state model (mig-016). Optional during the reader cutover. */
  mastery?: WordMastery
  introduced_at: string
  mastered_at: string | null
  replay_count: number
  box?: number
  due_at?: string | null
  last_reviewed_at?: string | null
  /** Parallel Leitner tracks (mig-016): receptive = hear→recognise, productive = say/recall. */
  box_receptive?: number
  box_productive?: number | null
  due_receptive?: string | null
  due_productive?: string | null
}

export interface MasteryBreakdown {
  introduced: number
  practicing: number
  mastered: number
  consolidated: number
}

/** A word the spaced-repetition scheduler says is due now. */
export interface ReviewItem {
  word_id: string
  box: number
  due_at: string
  word: Word
}

export interface ChildLessonProgress {
  id: string
  child_id: string
  lesson_id: string
  completed: boolean
  score: number | null
  completed_at: string | null
}

export interface ChildStoryProgress {
  id: string
  child_id: string
  story_id: string
  last_page: number
  completed: boolean
  replay_count: number
  last_read_at: string
}

export interface ChildSession {
  id: string
  child_id: string
  started_at: string
  ended_at: string | null
  duration_sec: number | null
}

// ── Badges ────────────────────────────────────────────────
export type BadgeKey =
  | 'first_lesson'
  | 'first_story'
  | 'words_10'
  | 'words_25'
  | 'stories_3'
  | 'lessons_5'
  | 'streak_7'
  | 'all_alphabet'
  | 'tried_today'
  | 'practiced_again'
  | 'streak_3'

export interface Badge {
  id: string
  key: BadgeKey
  title: string
  description: string | null
  image_url: string | null
  animation_template?: AnimationTemplate | null
  animation_params?: AnimationParams
}

export interface ChildBadge {
  id: string
  child_id: string
  badge_id: string
  earned_at: string
  badge?: Badge
}

// ── Dashboard ─────────────────────────────────────────────
export interface DashboardSummary {
  child: Child
  streak_days: number
  words_learned: number
  stories_completed: number
  lessons_completed: number
  xp: number
  /** Words bucketed by the mastery state machine (mig-016). */
  mastery_breakdown: MasteryBreakdown
  recent_sessions: ChildSession[]
  recent_badges: ChildBadge[]
}

// ── API responses ─────────────────────────────────────────
export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
