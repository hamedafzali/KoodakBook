import { LESSON_TYPE_EMOJI, type LessonType } from '@koodakbook/shared'
import type { IconName } from '@/components/Icon'
import { ramps, type Ramp } from '@/lib/theme'

/**
 * One room identity per lesson type: its ramp, its cast host (if it has one)
 * and its emoji fallback. Values copied 1:1 from Home's PATH_STYLE /
 * PATH_STORIES (app/home.tsx, from web's kit.tsx MODULE mapping), which
 * lessons.tsx mirrored as SECTION_STYLE -- one source so the Home path tile,
 * the lessons section header and a lesson screen can't drift apart.
 * (2026-09-27 design-system pass.) phonics has no host on web either; show
 * its emoji in the HostAvatar disc (see the Fallback rule in Clay.tsx).
 */
export type RoomStyle = { ramp: Ramp; character?: string; emoji: string }

export const LESSON_ROOM_STYLE: Record<LessonType, RoomStyle> = {
  vocabulary: { ramp: ramps.lessons, character: 'roozi', emoji: LESSON_TYPE_EMOJI.vocabulary ?? '📚' },
  alphabet: { ramp: ramps.letters, character: 'boomi', emoji: LESSON_TYPE_EMOJI.alphabet ?? '🔤' },
  phonics: { ramp: ramps.phonics, emoji: LESSON_TYPE_EMOJI.phonics ?? '🎵' },
}

/** The stories room (Home's PATH_STORIES). */
export const STORY_ROOM_STYLE: RoomStyle = { ramp: ramps.stories, character: 'pashmak', emoji: '📖' }

/** For a type string from the API: a type outside LessonType (the DB rules
 *  it out today) gets the lessons ramp, no host, and its own emoji if any --
 *  the same fallback lessons.tsx uses. */
export function lessonRoomStyle(type: string): RoomStyle {
  return (LESSON_ROOM_STYLE as Record<string, RoomStyle | undefined>)[type]
    ?? { ramp: ramps.lessons, emoji: LESSON_TYPE_EMOJI[type] ?? '📚' }
}

/**
 * Every child module's room, keyed like web's kit.tsx MODULE (ramp, host,
 * emoji copied 1:1) plus the line Icon (components/Icon.tsx) that stands for
 * it in UI chrome -- bottom nav, a section's see-all, a ScreenHeader host
 * fallback -- so a module looks the same on every screen (2026-09-28).
 * phonics/write have no host on web either (emoji in the disc).
 */
export type ModuleKey =
  | 'lessons' | 'letters' | 'phonics' | 'stories' | 'review' | 'speak' | 'write' | 'math' | 'games' | 'rewards' | 'videos'

export const MODULE_ROOM_STYLE: Record<ModuleKey, RoomStyle & { icon: IconName }> = {
  lessons: { ramp: ramps.lessons, character: 'roozi', emoji: '📚', icon: 'learn' },
  letters: { ramp: ramps.letters, character: 'boomi', emoji: '✏️', icon: 'pencil' },
  phonics: { ramp: ramps.phonics, emoji: '🎵', icon: 'volume' },
  stories: { ramp: ramps.stories, character: 'pashmak', emoji: '📖', icon: 'book' },
  review: { ramp: ramps.review, character: 'laki', emoji: '🔄', icon: 'refresh' },
  speak: { ramp: ramps.speak, character: 'ava', emoji: '🎤', icon: 'mic' },
  write: { ramp: ramps.write, emoji: '✍️', icon: 'pencil' },
  math: { ramp: ramps.math, character: 'khersi', emoji: '🔢', icon: 'plus' },
  games: { ramp: ramps.games, character: 'tondpa', emoji: '🃏', icon: 'gamepad' },
  rewards: { ramp: ramps.rewards, character: 'simorgh', emoji: '🏆', icon: 'trophy' },
  videos: { ramp: ramps.videos, emoji: '🎬', icon: 'play' },
}
