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
}

export type CreateChildInput = Pick<Child, 'name' | 'birth_year' | 'level' | 'avatar_url'>

// ── Content ───────────────────────────────────────────────
export interface Word {
  id: string
  persian: string
  english: string
  finglish: string | null
  category: WordCategory
  stage: number
  audio_url: string | null
  image_url: string | null
}

export type WordCategory = 'animals' | 'colors' | 'family' | 'food' | 'body' | 'nature' | 'objects'

export interface Letter {
  id: string
  character: string
  name_persian: string
  name_english: string
  group: number
  order_in_group: number
  audio_url: string | null
  example_word_id: string | null
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

export interface ChildWordProgress {
  id: string
  child_id: string
  word_id: string
  status: WordStatus
  introduced_at: string
  mastered_at: string | null
  replay_count: number
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
