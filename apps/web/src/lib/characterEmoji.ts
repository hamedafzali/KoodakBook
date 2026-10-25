import type { AppCharacter } from '@koodakbook/shared'

// Port of mobile's lib/characterEmoji.ts, for the one spot on web that needs
// a tiny inline token rather than a full CharacterAvatar render: مارپله's
// board tokens and player-picker chips, where a small emoji reads better at
// that size than a scaled-down SVG avatar. Anywhere a picture fits, draw
// CharacterAvatar instead — this is only the glyph fallback.
//
// The cast's own slugs map to the animal each one actually is (2026-09-29,
// same table as mobile's lib/characterEmoji.ts), so پشمک, تندپا and لاکی no
// longer all read as 🦊 via the `animal` type guess.
const BY_SLUG: Record<string, string> = {
  // EMOJI-CONTENT (whole file): cast members, not icons — see
  // components/icons.tsx for the rule and the split.
  // the pixel-wizards cast
  simorgh: '🦅',
  roozi: '🦊',
  ava: '👧',
  pashmak: '🐱',
  laki: '🐢',
  tondpa: '🐰',
  boomi: '🦉',
  khersi: '🐻',
  charkhi: '🚗',
  // legacy slugs from before the cast
  fox: '🦊',
  rabbit: '🐰',
  cat: '🐱',
  bear: '🐻',
}

const BY_TYPE: Record<AppCharacter['type'], string> = {
  child: '🧒',
  animal: '🐾',
  fantasy: '🦄',
}

export function characterEmoji(c: Pick<AppCharacter, 'slug' | 'type'>): string {
  // hasOwnProperty: a slug like "constructor" must not resolve to a function.
  return (Object.prototype.hasOwnProperty.call(BY_SLUG, c.slug) ? BY_SLUG[c.slug] : undefined)
    ?? BY_TYPE[c.type] ?? '🙂'
}
