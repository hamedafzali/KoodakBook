'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { getMode } from '@/lib/mode'

/**
 * Logged-in sessions skip the marketing page entirely — child mode persists
 * across relaunch, so the kid lands straight back in the app, never on a
 * sales pitch. Anonymous visitors see the landing this component sits on.
 */
export default function SessionRedirect() {
  const router = useRouter()
  useEffect(() => {
    if (!isLoggedIn()) return
    api.get('/api/auth/me').then(() => {
      if (!isLoggedIn()) return   // 401 handler already cleared the token
      router.replace(getMode() === 'child' ? '/child/home' : '/parent/dashboard')
    })
  }, [router])
  return null
}
