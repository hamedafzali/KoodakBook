'use client'
import { useEffect, useRef } from 'react'
import { CHARACTERS } from 'pixel-wizards-charachters'
import type { EmotionOverrides } from 'pixel-wizards-charachters'
import type { ThreeActor } from 'pixel-wizards-charachters/three'

/* The 3D renderer for a character — a thin, app-agnostic wrapper around the
 * library's `ThreeActor` (pixel-wizards-charachters/three, three.js).
 *
 * Three constraints shape it:
 *
 *  1. Every ThreeActor owns a WebGL context, and browsers allow only ~8-16 per
 *     page (the oldest is silently dropped past that). The app can show twenty
 *     avatars at once, so only MAX_LIVE are ever 3D together; the rest report
 *     `onActor(null)` and the caller keeps its SVG. First come, first served.
 *
 *  2. three.js is big. It's imported dynamically, only when a 3D avatar is
 *     actually mounted, so pages that never need it never download it.
 *
 *  3. The library hides the model until its 2D-art skin has loaded (bare
 *     primitives are "a stand-in, not a first frame"). `onActor` therefore
 *     fires only once the model is visible, so the caller can swap SVG -> 3D
 *     without a blank or half-dressed frame.
 *
 * `onActor(actor)` hands back the live ThreeActor (same apply / playGesture /
 * speak API as the SVG ActorRig); `onActor(null)` means "no 3D (or no longer)
 * — use the SVG". Never throws; any failure (no WebGL, import error, slots
 * full, never dressed) is reported as null. */

/** Most 3D characters alive at once across the whole page. */
export const MAX_LIVE_3D = 4
let live = 0
/** Set when 3D failed to start (typically: no WebGL). Don't retry per avatar. */
let unavailable = false

/** Give up waiting for the skin after this long and stay on the SVG. Generous
 *  on purpose: the SVG stays on screen meanwhile, so waiting costs nothing. */
const DRESS_TIMEOUT_MS = 10000

/** Build 3D characters one at a time. Skinning rasterises the character's 2D
 *  art on the main thread; doing several at once makes each slower and the page
 *  janky. Each avatar waits for the one before it to finish (or fail). */
let gate: Promise<void> = Promise.resolve()

interface Props {
  character: string
  size: number
  /** Per-emotion tuning. The model can't change these live, so a change
   *  rebuilds the 3D character (the caller's SVG covers the gap). */
  emotions?: EmotionOverrides
  onActor: (actor: ThreeActor | null) => void
  className?: string
}

export default function Actor3D({ character, size, emotions, onActor, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const actorRef = useRef<ThreeActor | null>(null)
  const sizeRef = useRef(size)
  const onActorRef = useRef(onActor)
  // Latest props for the async work below. Written in an effect (not during
  // render); declared first so it runs before the mount effect reads them.
  useEffect(() => {
    sizeRef.current = size
    onActorRef.current = onActor
  })
  // Rebuild only when the tuning's content changes, not its identity.
  const emotionsKey = JSON.stringify(emotions ?? null)

  useEffect(() => {
    const host = hostRef.current
    const spec = CHARACTERS[character as keyof typeof CHARACTERS]
    if (!host || !spec || unavailable || live >= MAX_LIVE_3D) {
      onActorRef.current(null)
      return
    }
    live++
    let holding = true
    const release = () => { if (holding) { holding = false; live-- } }

    let cancelled = false
    let actor: ThreeActor | null = null
    let raf: number | null = null

    // Take my turn in the queue; `finish()` hands it to the next avatar.
    // Idempotent, and called on every exit path (dressed, failed, unmounted).
    const prev = gate
    // The promise is created now (its executor runs synchronously), so `finish`
    // is always defined, even if this avatar unmounts before its turn arrives.
    let finish!: () => void
    const turn = new Promise<void>(resolve => { finish = resolve })
    gate = prev.then(() => turn)

    ;(async () => {
      try {
        await prev
        if (cancelled) { finish(); return }
        const { ThreeActor } = await import('pixel-wizards-charachters/three')
        if (cancelled) { finish(); return }
        // fallback:false → throws (leaving the host empty) when there's no
        // WebGL, instead of silently mounting a second SVG rig on top of ours.
        const a = new ThreeActor(spec, { size: sizeRef.current, emotions, fallback: false })
        a.mount(host)
        actor = a
        actorRef.current = a

        // Wait until the model is actually showing (skin loaded).
        const started = Date.now()
        const wait = () => {
          if (cancelled) return
          if (a.actor?.object.visible) { finish(); onActorRef.current(a); return }
          if (Date.now() - started > DRESS_TIMEOUT_MS) { giveUp(); return }
          raf = requestAnimationFrame(wait)
        }
        wait()
      } catch {
        unavailable = true
        giveUp()
      }
    })()

    function giveUp() {
      try { actor?.destroy() } catch { /* already gone */ }
      actor = null
      actorRef.current = null
      release()
      finish()
      if (!cancelled) onActorRef.current(null)
    }

    return () => {
      cancelled = true
      if (raf != null) cancelAnimationFrame(raf)
      try { actor?.destroy() } catch { /* already gone */ }
      actorRef.current = null
      release()
      finish()
      onActorRef.current(null)
    }
    // `emotions` is read through emotionsKey on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, emotionsKey])

  useEffect(() => { actorRef.current?.resize(size) }, [size])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, width: size, height: size, pointerEvents: 'none' }}
    />
  )
}
