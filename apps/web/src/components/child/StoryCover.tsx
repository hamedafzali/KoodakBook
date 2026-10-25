'use client'
import Image from 'next/image'
import { mediaUrl } from '@/lib/media'
import { Icon } from '@/components/icons'
import SceneBackdrop from '@/components/child/SceneBackdrop'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import { SCENE_SLUGS, type SceneSlug } from '@koodakbook/shared'

/* A story's illustrated cover — the story shelf (/child/story) and Home's
 * featured-stories row draw the SAME cover for the same story, so a child
 * who spots «خرگوش کوچولو» on Home finds the same picture on the shelf.
 *
 * Real cover art when the story has it. Otherwise (mobile stories.tsx
 * parity, 2026-09-29) a scene from the backdrop library, picked by the story
 * id so it never changes between visits, with پشمک — the stories room's
 * host — standing in it. Never a made-up cover: the old fallback put a
 * random emoji (🦊 🚀 🐳 …) over a hard-coded hue, which read as the story's
 * subject when it had nothing to do with the story. Always decorative: the
 * card around it is the link and carries the name. */

/** Same hash as mobile's `sceneFor`, so a coverless story gets the same
 *  scene on both clients. */
function sceneFor(id: string): SceneSlug {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SCENE_SLUGS[h % SCENE_SLUGS.length]
}

export default function StoryCover({ id, coverUrl, className = 'h-32', play = true, sizes, hostSize = 64 }: {
  id: string
  coverUrl?: string | null
  /** Height (and any extra) classes for the cover box. */
  className?: string
  /** The round play badge the reference cards carry — "this one reads to you". */
  play?: boolean
  sizes?: string
  /** پشمک's size on a coverless story — keep it under the cover's height. */
  hostSize?: number
}) {
  const src = mediaUrl(coverUrl ?? null)
  return (
    <div className={`relative w-full overflow-hidden ${className}`} aria-hidden="true">
      {src ? (
        <Image src={src} alt="" fill sizes={sizes ?? '(min-width: 1024px) 25vw, 50vw'} className="object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: 'var(--ramp-stories-soft)' }}>
          <SceneBackdrop scene={sceneFor(id)} className="w-full h-full !rounded-none" />
          <span className="absolute inset-x-0 bottom-0.5 flex justify-center pointer-events-none">
            <CharacterAvatar slug="pashmak" size={hostSize} mood="happy" />
          </span>
        </div>
      )}
      {play && (
        <span className="absolute bottom-2 end-2 w-9 h-9 rounded-full bg-white/95 shadow-card flex items-center justify-center"
          style={{ color: 'var(--ramp-stories-deep)' }}>
          {/* Nudged toward the triangle's visual centre; RTL-neutral (play
              points the same way in every script). */}
          <span className="translate-x-[1px]"><Icon name="play" size="sm" strokeWidth={2.6} /></span>
        </span>
      )}
    </div>
  )
}
