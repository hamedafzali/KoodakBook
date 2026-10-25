import { useCallback, useEffect, useRef } from 'react'

/**
 * `later(fn, ms)` — a setTimeout that is cleared when the component unmounts.
 *
 * Child screens schedule a lot of short follow-ups (advance to the next
 * round, say «چند تا بود؟», flip cards back). A bare setTimeout outlives the
 * screen: leaving mid-round made the voice line play on whatever screen the
 * child had moved to. Every timer started through here dies with the
 * component instead.
 */
export function useTimers() {
  const ids = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const live = ids.current
    return () => { live.forEach(clearTimeout); live.clear() }
  }, [])
  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => { ids.current.delete(id); fn() }, ms)
    ids.current.add(id)
    return id
  }, [])
}
