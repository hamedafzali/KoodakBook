'use client'
import { useState } from 'react'

/* Fluent Emoji, "Color" style, served as static SVG (apps/web/public/emoji/) —
 * see DESIGN_CHARTER.md and docs/design-system.md for the usage rule this
 * backs: section identity, BottomNav, feedback and celebration glyphs go
 * through <Emoji>, not a raw emoji character in JSX. Content emoji (counted
 * apples, board tokens, badge faces, story/room decoration) and apps/mobile
 * stay native — this is deliberately not a full emoji-replacement system.
 *
 * Assets: extracted from @iconify-json/fluent-emoji (Color), optimized with
 * SVGO. `party-popper` alone came from the Flat style instead — the Color
 * version's confetti detail put it over the 15KB budget. License for the
 * whole set: public/emoji/LICENSE (MIT, Microsoft/Iconify).
 */

const NATIVE = {
  'house': '🏠',
  'books': '📚',
  'open-book': '📖',
  'trophy': '🏆',
  'door': '🚪',
  'input-latin-letters': '🔤',
  'writing-hand': '✍️',
  'game-die': '🎲',
  'check-mark-button': '✅',
  'cross-mark': '❌',
  'speaker-high-volume': '🔊',
  'party-popper': '🎉',
  'sparkles': '✨',
  'balloon': '🎈',
} as const

export type EmojiName = keyof typeof NATIVE

interface EmojiProps {
  name: EmojiName
  /** Pixel size for both width and height (square asset). Default 24. */
  size?: number
  className?: string
  /** Persian label — pass this ONLY when the emoji is the sole content
   *  conveying meaning (no adjacent visible label already names it). Left
   *  out (default), the glyph renders alt="" + aria-hidden, i.e. decorative. */
  alt?: string
}

/** A Fluent Emoji glyph, loaded as a static SVG with a native-character
 *  fallback if the file fails to load (network hiccup, asset missing). */
export default function Emoji({ name, size = 24, className, alt }: EmojiProps) {
  const [failed, setFailed] = useState(false)
  const decorative = !alt

  if (failed) {
    return (
      <span
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative ? true : undefined}
        className={className}
        style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
      >
        {NATIVE[name]}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size static asset from /public, not an optimizable content image
    <img
      src={`/emoji/${name}.svg`}
      width={size}
      height={size}
      alt={decorative ? '' : alt}
      aria-hidden={decorative ? true : undefined}
      className={className}
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}
