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
