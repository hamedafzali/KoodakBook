import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { api } from './api'

/**
 * Records learning sessions per child so streaks/time in the parent dashboard
 * are real (web: lib/useSession.ts). Native equivalent of the browser's
 * visibility/beforeunload handling — AppState background/foreground opens and
 * closes the session, debounced so quick app switches don't spawn many.
 */
export function useChildSession(childId: string | null) {
  const sessionId = useRef<string | null>(null)
  const lastStart = useRef(0)

  useEffect(() => {
    if (!childId) return

    function start() {
      if (sessionId.current) return
      if (Date.now() - lastStart.current < 120_000) return   // debounce 2 min
      lastStart.current = Date.now()
      api.post<{ id: string }>('/api/progress/sessions/start', { child_id: childId })
        .then((res) => { if (res.data) sessionId.current = res.data.id })
    }

    function end() {
      const id = sessionId.current
      if (!id) return
      sessionId.current = null
      // Fire-and-forget; the endpoint is idempotent and needs no auth.
      void api.post(`/api/progress/sessions/${id}/end`, {})
    }

    start()

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') start()
      else if (state === 'background' || state === 'inactive') end()
    })

    return () => { sub.remove(); end() }
  }, [childId])
}
