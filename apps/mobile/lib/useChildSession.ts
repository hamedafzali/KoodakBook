import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { api } from './api'

/**
 * Records learning sessions per child so streaks/time in the parent dashboard
 * are real (web: lib/useSession.ts). Native equivalent of the browser's
 * visibility/beforeunload handling — AppState background/foreground opens and
 * closes the session, debounced so quick app switches don't spawn many.
 *
 * 2026-09-27: two ways play time went unrecorded, both fixed without
 * changing the endpoints or the 2-minute debounce:
 *  - Coming back to the app inside the debounce window (a glance at a
 *    notification, iOS's Control Center = `inactive`) ended the session and
 *    started none; nothing retried, so the rest of that visit was lost. The
 *    start is now deferred to the end of the window instead of dropped.
 *  - A start whose response arrived after the session was ended (app
 *    backgrounded, Home unmounted, child switched) was stored and never
 *    ended. It is now ended as soon as its id arrives.
 */
export function useChildSession(childId: string | null) {
  const sessionId = useRef<string | null>(null)
  const lastStart = useRef(0)

  useEffect(() => {
    if (!childId) return
    // True while the child is in the app and a session should be open.
    let wanted = false
    let deferred: ReturnType<typeof setTimeout> | null = null
    const clearDeferred = () => { if (deferred) { clearTimeout(deferred); deferred = null } }

    function postEnd(id: string) {
      // Fire-and-forget; the endpoint is idempotent and needs no auth.
      void api.post(`/api/progress/sessions/${id}/end`, {}).catch(() => {})
    }

    function start() {
      wanted = true
      if (sessionId.current || deferred) return
      const wait = 120_000 - (Date.now() - lastStart.current)   // debounce 2 min
      if (wait > 0) {
        deferred = setTimeout(() => { deferred = null; if (wanted) start() }, wait)
        return
      }
      lastStart.current = Date.now()
      api.post<{ id: string }>('/api/progress/sessions/start', { child_id: childId })
        .then((res) => {
          if (!res.data) return
          if (wanted && !sessionId.current) sessionId.current = res.data.id
          else postEnd(res.data.id)   // ended (or replaced) while this was in flight
        })
        .catch(() => {})
    }

    function end() {
      wanted = false
      clearDeferred()
      const id = sessionId.current
      if (!id) return
      sessionId.current = null
      postEnd(id)
    }

    start()

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') start()
      else if (state === 'background' || state === 'inactive') end()
    })

    return () => { sub.remove(); end() }
  }, [childId])
}
