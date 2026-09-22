'use client'
import { useEffect, useRef } from 'react'
import { CharacterActor } from 'pixel-wizards-charachters/react'
import { CHARACTERS, PetDriver } from 'pixel-wizards-charachters'
import type { ActorRig, EmotionOverrides, VisemeName, Locomotion } from 'pixel-wizards-charachters'
import { useCharacterEmotions } from '@/lib/characterEmotions'
import { MOOD_TO_EMOTION, MOOD_INTENSITY, type CharacterMood } from './mood'

/* Character visuals + ACTING.
 *
 * A thin adapter over the `pixel-wizards-charachters` library: the
 * illustration-grade art, the animation rig, Persian-viseme lip-sync, gaze,
 * brows, gestures and locomotion all live in that npm package. EVERY character
 * — including سیمرغ (the mascot) — renders from the library, so nothing comes
 * from app-local art. Unknown slugs fall back to سیمرغ. This component keeps the
 * exact call-site API the app already uses, so nothing else changes:
 *  - mood   : any name in `mood.ts` — all twelve rig emotions (→ library emotion)
 *  - talking: generic mouth flap while audio plays
 *  - mouth  : 0..1 viseme openness from a Performance track (useActing) — beats
 *             the generic `talking` loop when set.
 *  - viseme : the actual mouth SHAPE for that beat (useActing again) — pairs
 *             with `mouth`; omitted, the shape stays 'rest' (today's flap).
 *  - pettable: opt-in stroke interaction (see below).
 *
 * PETTING (task 58 — wiring the library's PetDriver into the app). The
 * library ships `PetDriver` as a pure, DOM-free accumulator: feed it pointer
 * samples in the character's 200×200 art space, tick it every frame, merge
 * its output onto the frame you were already sending (see pet.ts's own
 * doc comment for the full contract). It does NOT do hit-testing, pointer
 * capture or DOM work — that stays here, the one place in the app that
 * already owns a rigRef.
 *
 * Kept opt-in (`pettable`, default false) rather than always-on: most
 * `CharacterAvatar` call sites are small and decorative (a 40px module badge,
 * a nav icon, a lesson-thumbnail host) where an accidental drag reads as a
 * misclick, not a pet. Only a "this avatar IS the character, at a size a
 * child would actually reach out and touch" call site should set it — today
 * that's the friend's-home hero avatar (apps/web/src/app/child/friends/
 * [slug]/page.tsx). Turning it on elsewhere is a one-line, deliberate choice
 * per screen, not a global default.
 *
 * `pettable` adds one extra wrapping <div> (for pointer-capture + art-space
 * coordinate mapping via its own bounding rect) — only when the prop is set,
 * so every existing non-pettable call site's DOM shape is unchanged. */

/* The vocabulary lives in mood.ts so Mascot and CharacterAvatar can't drift.
 * Re-exported because call sites already import the type from here. */
export type { CharacterMood }

interface Props {
  slug: string
  size?: number
  mood?: CharacterMood
  talking?: boolean
  /** Driven viseme openness 0..1 from a performance track (useActing). */
  mouth?: number
  /** The rig's real mouth shape for this beat (useActing) — pairs with
   *  `mouth`. Omitted, the shape stays 'rest' regardless of `mouth`. */
  viseme?: VisemeName
  /** per-emotion tuning saved in the DB (animation.emotions) */
  emotions?: EmotionOverrides
  /** Body locomotion (idle/walk/fly/roll). Omitted, the rig stays idle —
   *  most call sites never move the body, only the face. */
  locomotion?: Locomotion
  className?: string
  /** Opt in to stroke-driven petting (PetDriver). See the file doc comment
   *  above for why this defaults to off. */
  pettable?: boolean
  /** Fired on a genuine tap/click — i.e. one that did NOT turn into a pet
   *  stroke. Only meaningful with `pettable`; a plain (non-pettable) avatar
   *  can keep using a wrapping <button onClick> exactly as before, since
   *  there is nothing here to disambiguate a stroke from. */
  onTap?: () => void
}

/** Below this many art-space units of travel, a pointer-down/up is a tap,
 *  not a stroke — matches PetDriver's own jitter tolerance (it clamps a
 *  single sample's contribution at 24 units) rather than inventing a
 *  second number. */
const TAP_THRESHOLD = 6

export default function CharacterAvatar({ slug, size = 120, mood = 'idle', talking, mouth, viseme, emotions, locomotion, className, pettable = false, onTap }: Props) {
  // Every real character is in the library; unknown slugs fall back to سیمرغ so
  // the avatar still renders from the npm package rather than app-local art.
  const character = slug in CHARACTERS ? slug : 'simorgh'
  const rig = useRef<ActorRig | null>(null)
  const emotion = MOOD_TO_EMOTION[mood]
  const intensity = MOOD_INTENSITY[mood]
  // Explicit overrides win; otherwise use whatever the admin saved for this slug.
  const savedEmotions = useCharacterEmotions(slug)
  const effEmotions = emotions ?? savedEmotions

  // Emotion / body-motion pose.
  useEffect(() => {
    rig.current?.apply({ emotion, intensity })
  }, [character, emotion, intensity])

  // Locomotion. Left untouched (rig default: idle) when the call site never
  // passes one, so every existing avatar keeps behaving exactly as before.
  useEffect(() => {
    if (locomotion == null) return
    rig.current?.apply({ locomotion })
  }, [character, locomotion])

  // Mouth: an explicit viseme track (mouth) wins; else a generic talking flap;
  // else the resting mouth for the emotion.
  useEffect(() => {
    const r = rig.current
    if (!r) return
    if (mouth != null) {
      r.apply({ viseme: viseme ?? 'rest', mouthOpen: Math.max(0, Math.min(1, mouth)) })
      return
    }
    if (!talking) {
      r.apply({ viseme: 'rest', mouthOpen: 0 })
      return
    }
    const t0 = Date.now()
    const id = setInterval(() => {
      const p = ((Date.now() - t0) % 320) / 320
      r.apply({ viseme: 'rest', mouthOpen: 0.3 + 0.35 * (0.5 - 0.5 * Math.cos(p * 2 * Math.PI)) })
    }, 55)
    return () => clearInterval(id)
  }, [character, mouth, viseme, talking])

  // --- Petting (PetDriver) --------------------------------------------
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const petRef = useRef<PetDriver | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef(0)
  const downRef = useRef<{ x: number; y: number } | null>(null)
  const draggedRef = useRef(false)

  // One driver per (pettable, character): a character swap needs a fresh
  // driver (its zone geometry is per-spec), and turning `pettable` off mid-
  // life should drop any accumulated affection rather than leave a ticking
  // loop nothing reads.
  useEffect(() => {
    if (!pettable) { petRef.current = null; return }
    const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const spec = CHARACTERS[character as keyof typeof CHARACTERS] ?? CHARACTERS.simorgh
    petRef.current = new PetDriver(spec, { reducedMotion: reduced })
    return () => {
      petRef.current?.reset()
      petRef.current = null
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [pettable, character])

  function toArtSpace(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = wrapRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    // PetDriver's zones are authored in the character's 200×200 art space
    // regardless of the rendered `size`, so map by fraction, not by pixel.
    return { x: ((clientX - rect.left) / rect.width) * 200, y: ((clientY - rect.top) / rect.height) * 200 }
  }

  // requestAnimationFrame loop, alive only while a hand is down or affection
  // is still decaying — never runs for a non-pettable avatar, and stops
  // itself the instant there's nothing left to animate.
  function ensureLoop() {
    if (rafRef.current != null) return
    lastTickRef.current = performance.now()
    const step = (now: number) => {
      const pet = petRef.current
      const r = rig.current
      if (!pet || !r) { rafRef.current = null; return }
      const dt = Math.min(0.1, Math.max(0, (now - lastTickRef.current) / 1000))
      lastTickRef.current = now
      const out = pet.tick(dt)
      // A non-null emotion means PetDriver wants the face; null means "give
      // it back" — re-assert the mood-driven resting state explicitly so the
      // rig doesn't coast on a stale petted expression once the hand lifts
      // and affection has decayed away.
      r.apply(out.emotion
        ? { emotion: out.emotion, intensity: out.intensity, gaze: out.gaze ?? { x: 0, y: 0 } }
        : { emotion, intensity, gaze: out.gaze ?? { x: 0, y: 0 } })
      if (out.gesture) r.playGesture(out.gesture)
      if (out.affection > 0 || downRef.current != null) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!pettable || !petRef.current) return
    const p = toArtSpace(e.clientX, e.clientY)
    if (!p) return
    downRef.current = p
    draggedRef.current = false
    petRef.current.stroke(p.x, p.y)
    ensureLoop()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* unsupported — fine, stroking still works */ }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pettable || !petRef.current || downRef.current == null) return
    const p = toArtSpace(e.clientX, e.clientY)
    if (!p) return
    if (Math.hypot(p.x - downRef.current.x, p.y - downRef.current.y) > TAP_THRESHOLD) draggedRef.current = true
    petRef.current.stroke(p.x, p.y)
  }
  function endStroke() {
    if (!pettable || !petRef.current) return
    petRef.current.release()
    downRef.current = null
    ensureLoop() // keep ticking so affection actually decays back to rest
  }
  // Swallow the click this pointer sequence would otherwise produce once it
  // turns out to have been a stroke, not a tap — stopPropagation here (not
  // preventDefault on pointerup, which doesn't reliably suppress the
  // synthetic click across browsers) keeps a wrapping <button onClick> (the
  // "tap to replay the greeting" affordance the friend's-home page already
  // has) from firing on the way OUT of a pet.
  function onClickCapture(e: React.MouseEvent) {
    if (!pettable) return
    if (draggedRef.current) { e.stopPropagation(); draggedRef.current = false; return }
    onTap?.()
  }

  const actor = (
    <CharacterActor
      character={character}
      size={size}
      className={pettable ? undefined : className}
      style={pettable ? { width: size, height: size } : { width: size, height: size }}
      emotions={effEmotions}
      rigRef={rig}
    />
  )

  if (!pettable) return actor

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ width: size, height: size, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onPointerLeave={endStroke}
      onClickCapture={onClickCapture}
    >
      {actor}
    </div>
  )
}
