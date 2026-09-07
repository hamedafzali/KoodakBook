import type { AppCharacter } from '@koodakbook/shared'

// Port of mobile's lib/characterEmoji.ts, for the one spot on web that needs
// a tiny inline token rather than a full CharacterAvatar render: مارپله's
// board tokens and player-picker chips, where a small emoji reads better at
// that size than a scaled-down SVG avatar.
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
