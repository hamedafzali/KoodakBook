/* Saved per-emotion tuning, applied app-wide.
 *
 * The admin panel lets an editor tune each character's emotions (squint, eye
 * widen, resting mouth, brow) and saves them to `characters.animation.emotions`.
 * This module fetches those once (shared across every avatar on the page) and
 * hands each character its override map, so the whole app emotes with the tuned
 * values — no call site has to know they exist. */
import { useEffect, useState } from 'react'
import { api } from './api'
import type { AppCharacter } from '@koodakbook/shared'
import type { EmotionOverrides } from 'pixel-wizards-charachters'

let cache: Record<string, EmotionOverrides> | null = null
let inflight: Promise<Record<string, EmotionOverrides>> | null = null
const subscribers = new Set<() => void>()

function load(): Promise<Record<string, EmotionOverrides>> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight
  inflight = api.get<AppCharacter[]>('/api/characters')
    .then(r => {
      const map: Record<string, EmotionOverrides> = {}
      for (const c of r.data ?? []) {
        const em = (c.animation?.emotions ?? {}) as EmotionOverrides
        if (em && Object.keys(em).length) map[c.slug] = em
      }
      cache = map
      inflight = null
      subscribers.forEach(fn => fn())
      return map
    })
    .catch(() => { inflight = null; return {} })
  return inflight
}

/** The saved overrides for one character, or `undefined` until they load. */
export function useCharacterEmotions(slug: string): EmotionOverrides | undefined {
  const [, force] = useState(0)
  useEffect(() => {
    if (cache) return
    const fn = () => force(n => n + 1)
    subscribers.add(fn)
    void load()
    return () => { subscribers.delete(fn) }
  }, [])
  return cache?.[slug]
}
