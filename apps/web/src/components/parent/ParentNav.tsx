'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { enterChildMode } from '@/lib/mode'

const ITEMS = [
  { href: '/parent/dashboard', label: 'داشبورد', icon: '📊' },
  { href: '/parent/progress', label: 'پیشرفت', icon: '📈' },
  { href: '/parent/settings', label: 'تنظیمات', icon: '⚙️' },
  { href: '/parent/share', label: 'اشتراک‌گذاری', icon: '📤' },
]

/** Desktop-only (lg+) sidebar nav for the parent area. */
export default function ParentNav() {
  const path = usePathname()
  const router = useRouter()
  // No indicator anywhere told a logged-in parent which account they were
  // in — surface it here since the sidebar is the one thing visible on
  // every parent page.
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => {
    api.get<{ email: string }>('/api/auth/me').then(res => {
      if (res.data?.email) setEmail(res.data.email)
    })
  }, [])
  return (
    <nav className="w-56 shrink-0 p-4">
      <div className="px-3 py-3 mb-2">
        <p className="font-bold text-slate-800">پنل والدین</p>
        <p className="text-xs text-slate-400">پیشرفت کودک شما</p>
        {email && (
          <p className="text-xs text-slate-500 truncate ltr text-left mt-1" dir="ltr" title={email}>{email}</p>
        )}
      </div>
      <div className="space-y-1">
        {ITEMS.map(i => {
          const on = path.startsWith(i.href)
          return (
            <Link key={i.href} href={i.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                on ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>
              <span>{i.icon}</span>{i.label}
            </Link>
          )
        })}
      </div>
      <button
        onClick={() => { enterChildMode({ pick: true }); router.push('/child/home') }}
        className="w-full text-right flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-white/70 mt-6">
        <span>👶</span> حالت کودک
      </button>
    </nav>
  )
}
