'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { isLoggedIn, clearToken } from '@/lib/auth'
import { api } from '@/lib/api'

const NAV: { href: string; label: string; emoji: string; perm?: string }[] = [
  { href: '/dashboard',         label: 'داشبورد',  emoji: '📊' },
  { href: '/dashboard/users',   label: 'کاربران',  emoji: '👨‍👩‍👧', perm: 'users.read' },
  { href: '/dashboard/team',    label: 'تیم و دسترسی', emoji: '🔐', perm: 'admin.manage' },
  { href: '/dashboard/plans',   label: 'پلن‌ها',    emoji: '💳', perm: 'plans.manage' },
  { href: '/dashboard/pilot',   label: 'پایلوت',   emoji: '🧪', perm: 'analytics.view' },
  { href: '/dashboard/audit',   label: 'فعالیت‌ها', emoji: '📜', perm: 'audit.read' },
  { href: '/dashboard/lessons', label: 'درس‌ها',   emoji: '🗂️', perm: 'content.read' },
  { href: '/dashboard/stories', label: 'داستان‌ها', emoji: '📖', perm: 'content.read' },
  { href: '/dashboard/words',   label: 'کلمات',    emoji: '📝', perm: 'content.read' },
  { href: '/dashboard/letters', label: 'حروف',     emoji: '🔤', perm: 'content.read' },
]

const hasPerm = (perms: string[], p: string) => perms.includes('*') || perms.includes(p)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [perms, setPerms] = useState<string[]>([])

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return }
    api.get<{ admin: boolean; permissions: string[] }>('/api/admin/me').then(res => {
      if (res.error || !res.data?.admin) router.replace('/login')
      else { setPerms(res.data.permissions ?? []); setAuthorized(true) }
    })
  }, [router])

  const visibleNav = NAV.filter(i => !i.perm || hasPerm(perms, i.perm))

  if (!authorized) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">در حال بررسی دسترسی...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      <aside className="w-56 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-100">
          <h1 className="font-bold text-lg text-amber-600">KoodakBook</h1>
          <p className="text-xs text-gray-400">پنل مدیریت</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                pathname === item.href ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <span>{item.emoji}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={() => { clearToken(); router.push('/login') }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition">
            <span>🚪</span> خروج
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
