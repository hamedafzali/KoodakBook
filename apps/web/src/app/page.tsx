'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn } from '@/lib/auth'
import { getMode } from '@/lib/mode'

/**
 * Entry router. A logged-in device lands by mode (child stays in child mode
 * across relaunch — no login/PIN for the kid); otherwise to login.
 */
export default function RootPage() {
  const router = useRouter()
  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return }
    router.replace(getMode() === 'child' ? '/child/home' : '/parent/dashboard')
  }, [router])
  return null
}
