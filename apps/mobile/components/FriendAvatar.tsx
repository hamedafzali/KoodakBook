import { Text, View } from 'react-native'
import type { AppCharacter } from '@koodakbook/shared'
import type { EmotionName } from 'pixel-wizards-charachters'
import { CharacterArt } from '@/components/Clay'
import { hasCharacterArt } from '@/lib/characterSvg'
import { fonts, naturalLineHeight, radii, ramps, type Ramp } from '@/lib/theme'

/**
 * A friend's picture. The cast's slugs from /api/characters (simorgh, roozi,
 * ava, pashmak, laki, tondpa, khersi, boomi) are the character library's own
 * slugs, so they get the same art Home draws. characterEmoji only knew the
 * old slugs (fox, rabbit, cat, bear), which sent pashmak, tondpa and laki to
 * the `animal` fallback: every one of them showed 🦊 (seen on the iOS
 * Simulator, 2026-09-25).
 *
 * A slug the library doesn't draw gets a designed stand-in: the friend's own
 * initial in a filled disc of the friends room's ramp (the same idea as the
 * child picker's initial disc). It used to be characterEmoji's type guess
 * (every `animal` a 🦊, every `fantasy` a 🦄), which could contradict the
 * friend's name. Decorative: the name next to it is what gets read out.
 */
/**
 * A friend's colour: the ramp they already wear as a room host on Home
 * (app/home.tsx TILES / lib/roomStyle.ts), so پشمک is teal on the friends
 * grid, at the stories door and on Home alike. A slug Home doesn't host
 * gets the friends room's own ramp (phonics). Decorative only -- every
 * text on it is the ramp's ink or scenery.ink, measured per ramp.
 */
const FRIEND_RAMP: Record<string, Ramp> = {
  simorgh: ramps.rewards, roozi: ramps.lessons, ava: ramps.speak, pashmak: ramps.stories,
  laki: ramps.review, tondpa: ramps.games, khersi: ramps.math, boomi: ramps.letters,
}
export function friendRamp(slug: string | null | undefined): Ramp {
  return (slug && FRIEND_RAMP[slug]) || ramps.phonics
}

/** The personality's first clause (the traits before «—»), for a one-line
 *  tagline on a card: «مهربان، دانا، آرام — قصه‌گوی …» -> «مهربان، دانا، آرام».
 *  The full line stays in the card's spoken label and on the friend's page. */
export function shortPersonality(personality: string | null | undefined): string {
  return (personality ?? '').split(/\s+[—–-]\s+/)[0].trim()
}

export default function FriendAvatar({ character, size, emotion = 'happy', ramp = ramps.phonics }: {
  character: AppCharacter
  size: number
  emotion?: EmotionName
  /** The fallback disc's colours; the art itself ignores it. */
  ramp?: Ramp
}) {
  if (hasCharacterArt(character.slug)) {
    return <CharacterArt character={character.slug} emotion={emotion} size={size} />
  }
  // Array.from: the first code point, never half a surrogate pair.
  const initial = Array.from((character.name_persian ?? '').trim())[0] ?? ''
  const fontSize = Math.round(size * 0.46)
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size, height: size, borderRadius: radii.pill, backgroundColor: ramp.soft,
        borderWidth: Math.max(2, Math.round(size / 24)), borderColor: ramp.bright,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}
    >
      {/* Sized to the disc, not the reader's text size: at 200% the letter
          overflowed it (the disc is art; the name beside it scales). */}
      <Text maxFontSizeMultiplier={1} style={{ fontFamily: fonts.display, fontSize, lineHeight: naturalLineHeight(fontSize), color: ramp.ink }}>
        {initial}
      </Text>
    </View>
  )
}
