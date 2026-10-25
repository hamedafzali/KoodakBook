import type { AppCharacter } from '@koodakbook/shared'

// Text-only stand-in for a character: a board token (MarpeleBoard draws
// strings), a status line ("… بازی می‌کند"), a socket display emoji. Anywhere
// a picture fits, draw the real art instead -- FriendAvatar / CharacterArt
// (lib/characterSvg.ts hasCharacterArt) -- this is only the glyph fallback.
// The cast's own slugs map to the animal each one actually is, so پشمک,
// تندپا and لاکی no longer all read as 🦊 (the `animal` type guess).
const BY_SLUG: Record<string, string> = {
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
  return (Object.prototype.hasOwnProperty.call(BY_SLUG, c.slug) ? BY_SLUG[c.slug] : undefined)
    ?? BY_TYPE[c.type] ?? '🙂'
}
