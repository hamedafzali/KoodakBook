import type { AppCharacter } from '@koodakbook/shared'

// Web draws characters with per-slug SVG avatars (CharacterAvatar). Until
// those are ported, a friendly emoji stands in — per-slug where we know the
// character, falling back to its type.
const BY_SLUG: Record<string, string> = {
  simorgh: '🦅',
  fox: '🦊',
  rabbit: '🐰',
  cat: '🐱',
  bear: '🐻',
}

const BY_TYPE: Record<AppCharacter['type'], string> = {
  child: '🧒',
  animal: '🦊',
  fantasy: '🦄',
}

export function characterEmoji(c: AppCharacter): string {
  return BY_SLUG[c.slug] ?? BY_TYPE[c.type] ?? '🙂'
}
