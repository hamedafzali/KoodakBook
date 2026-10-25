import { CHARACTERS, defaultFrame, renderActorSVG } from 'pixel-wizards-charachters'
import type { ActorFrame, EmotionName } from 'pixel-wizards-charachters'

/**
 * Static (non-animated) character art for places mobile has no rig mounted —
 * a splash screen, a share card, anywhere a single still pose is enough.
 * `pixel-wizards-charachters`'s `ActorRig` is DOM-only (it mounts into an
 * `HTMLDivElement` and mutates it imperatively — see the library's
 * `react.tsx`), so it cannot run in React Native at all. `renderActorSVG` is
 * the one part of the library that's a pure string builder with no DOM
 * dependency: it returns a plain `<svg>...</svg>` markup string for one
 * frame, which `react-native-svg`'s `SvgXml` renders directly. That covers
 * every still-pose use; a *moving* character (petting, gestures, lip-sync)
 * needs a real RN port of `ActorRig`, which this does not attempt.
 *
 * One adjustment: the web build gets each character's eyelid colour from a
 * CSS custom property (`style="--lidfill:…"` on the root `<svg>`, read back
 * inside as `fill="var(--lidfill)"`). `SvgXml`'s parser doesn't resolve CSS
 * variables — there's no cascade, it isn't a browser — so `var(--lidfill)`
 * would pass straight through as a literal, invalid `fill` and the lid
 * ellipse would fail to paint. Inlining the character's own `lidColor` here
 * fixes that without touching the library.
 */
export function characterSvg(
  slug: string,
  opts: { emotion?: EmotionName; intensity?: number; size?: number } = {},
): string {
  const spec = CHARACTERS[slug] ?? CHARACTERS.simorgh
  const base = defaultFrame(spec.slug)
  const frame: ActorFrame = {
    ...base,
    emotion: opts.emotion ?? base.emotion,
    intensity: opts.intensity ?? base.intensity,
  }
  const svg = renderActorSVG(spec, frame, opts.size ?? 120)
  return svg.replace(/var\(--lidfill\)/g, spec.lidColor)
}

/** The cast the library draws (roster order): simorgh, roozi, ava, pashmak,
 *  laki, tondpa, boomi, khersi, charkhi. */
export type CastSlug =
  | 'simorgh' | 'roozi' | 'ava' | 'pashmak' | 'laki' | 'tondpa' | 'boomi' | 'khersi' | 'charkhi'

/** True when the library draws this slug itself. characterSvg() (and so
 *  CharacterArt) silently falls back to Simorgh for anything else, so check
 *  before relying on it -- or use artSlug() to pick the fallback on purpose. */
export function hasCharacterArt(slug: string | null | undefined): slug is CastSlug {
  return !!slug && Object.prototype.hasOwnProperty.call(CHARACTERS, slug)
}

/** `slug` when it has art, else `fallback` (Simorgh, the app's guide): the
 *  same result characterSvg() gives, but explicit at the call site. */
export function artSlug(slug: string | null | undefined, fallback: CastSlug = 'simorgh'): CastSlug {
  return hasCharacterArt(slug) ? slug : fallback
}

/**
 * Who hosts each room -- web's kit.tsx MODULE mapping, 1:1 (and the
 * library's own `role` for each character). Lesson types map onto their
 * rooms (vocabulary -> lessons, alphabet -> letters). phonics, write and
 * friends have no host on web either: they keep their emoji in the
 * HostAvatar disc (Clay.tsx's Fallback rule). چرخی (charkhi) hosts no room;
 * it is the Home journey companion ('journey'). سیمرغ is the guide.
 */
export type RoomKey =
  | 'lessons' | 'vocabulary' | 'letters' | 'alphabet' | 'phonics' | 'stories'
  | 'review' | 'speak' | 'write' | 'math' | 'games' | 'rewards' | 'friends'
  | 'guide' | 'journey'

export const ROOM_HOST: Readonly<Record<RoomKey, CastSlug | undefined>> = {
  lessons: 'roozi', vocabulary: 'roozi',
  letters: 'boomi', alphabet: 'boomi',
  phonics: undefined,
  stories: 'pashmak',
  review: 'laki',
  speak: 'ava',
  write: undefined,
  math: 'khersi',
  games: 'tondpa',
  rewards: 'simorgh',
  friends: undefined,
  guide: 'simorgh',
  journey: 'charkhi',
}

/** The room's host slug, or undefined for a room without one (show its
 *  emoji in the HostAvatar disc) or a key this table doesn't know. */
export function roomHost(room: string): CastSlug | undefined {
  return Object.prototype.hasOwnProperty.call(ROOM_HOST, room)
    ? (ROOM_HOST as Record<string, CastSlug | undefined>)[room]
    : undefined
}
