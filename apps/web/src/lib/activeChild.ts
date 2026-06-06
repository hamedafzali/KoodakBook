import type { Child } from '@koodakbook/shared'

const KEY = 'koodakbook_active_child'

export function getActiveChildId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEY)
}

export function setActiveChildId(id: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, id)
}

/**
 * Pick the active child from a list: the one stored in localStorage if it
 * still exists, otherwise the first. Returns undefined for an empty list.
 */
export function pickChild(children: Child[]): Child | undefined {
  if (children.length === 0) return undefined
  const id = getActiveChildId()
  return children.find(c => c.id === id) ?? children[0]
}
