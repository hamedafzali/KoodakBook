'use client'
import { useEffect, useRef } from 'react'
import { api } from './api'
import { getToken } from './auth'

export function useChildSession(childId: string | null) {
  const sessionId = useRef<string | null>(null)

  useEffect(() => {
    if (!childId) return

    // start session
    api.post<{ id: string }>('/api/progress/sessions/start', { child_id: childId })
      .then(res => { if (res.data) sessionId.current = res.data.id })

    function endSession() {
      if (!sessionId.current) return
      // sendBeacon with relative URL — works because Next.js proxies /api/* to backend
      const url = `/api/progress/sessions/${sessionId.current}/end`
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({})], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
      }
      sessionId.current = null
    }

    function endSessionFetch() {
      if (!sessionId.current) return
      const id = sessionId.current
      sessionId.current = null
      api.post(`/api/progress/sessions/${id}/end`, {})
    }

    // end when tab is hidden (most reliable for mobile)
    function handleVisibility() {
      if (document.visibilityState === 'hidden') endSession()
      if (document.visibilityState === 'visible' && !sessionId.current) {
        // resume — start a new session
        api.post<{ id: string }>('/api/progress/sessions/start', { child_id: childId })
          .then(res => { if (res.data) sessionId.current = res.data.id })
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', endSession)

    // end on React unmount (navigating to a different page)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', endSession)
      endSessionFetch()
    }
  }, [childId])
}
