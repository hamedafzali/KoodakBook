'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { getMode } from '@/lib/mode'

/**
 * Entry router. Confirms the session up front (a deleted/suspended account is
 * caught here and sent to /login by the api client, rather than flashing a shell
 * and bouncing mid-task), then lands by mode — child mode persists across
 * relaunch so the kid never sees a login or PIN.
 */
export default function RootPage() {
  const router = useRouter()
  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return }
    api.get('/api/auth/me').then(() => {
      // A dead session already redirected to /login (401 handler cleared the token).
      if (!isLoggedIn()) return
      router.replace(getMode() === 'child' ? '/child/home' : '/parent/dashboard')
    })
  }, [router])
  return null
}
