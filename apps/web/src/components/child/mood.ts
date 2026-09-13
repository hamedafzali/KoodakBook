import type { EmotionName } from 'pixel-wizards-charachters'

/* The app's mood vocabulary — one entry per emotion the rig actually ships.
 *
 * `pixel-wizards-charachters` has carried twelve emotions since 1.0 (see
 * EMOTIONS / EMOTION_LABELS in the package). The app exposed three of them
 * through Mascot and five through CharacterAvatar, so nine rigged expressions
 * were unreachable from any screen. This module is the single vocabulary both
 * components read, so a mood added here is immediately available everywhere.
 *
 * `idle` is kept as the long-standing alias for the rig's `neutral`, because
 * every existing call site says `mood="idle"`. Every other name is the rig's
 * own emotion name, so there is nothing to translate or remember.
 *
 * Widening this also makes two casts honest: the friends screens do
 * `line.emotion as CharacterMood` against emotions stored in the DB, which
 * previously resolved to `undefined` for anything outside the five allowed
 * names. */
export type CharacterMood =
  | 'idle'
  | 'happy'
  | 'excited'
  | 'encouraging'
  | 'thinking'
  | 'proud'
  | 'surprised'
  | 'confused'
  | 'sad'
  | 'sleepy'
  | 'love'
  | 'shy'

export const MOOD_TO_EMOTION: Record<CharacterMood, EmotionName> = {
  idle: 'neutral',
  happy: 'happy',
  excited: 'excited',
  encouraging: 'encouraging',
  thinking: 'thinking',
  proud: 'proud',
  surprised: 'surprised',
  confused: 'confused',
  sad: 'sad',
  sleepy: 'sleepy',
  love: 'love',
  shy: 'shy',
}

/* How hard to play each emotion. The celebratory ones run at or near full;
 * anything a child sees after a mistake stays deliberately gentle, so a wrong
 * answer never gets a big sad face pointed at it (DESIGN_CHARTER.md: keep
 * mistakes gentle and encouraging, never harsh). */
export const MOOD_INTENSITY: Record<CharacterMood, number> = {
  idle: 0.6,
  happy: 0.85,
  excited: 1,
  encouraging: 0.85,
  thinking: 0.7,
  proud: 0.95,
  surprised: 0.9,
  confused: 0.7,
  sad: 0.55,
  sleepy: 0.7,
  love: 0.85,
  shy: 0.7,
}
