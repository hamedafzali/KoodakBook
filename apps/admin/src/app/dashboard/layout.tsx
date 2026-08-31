'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { isLoggedIn, clearToken } from '@/lib/auth'
import { api } from '@/lib/api'
import { Icon } from '@/components/icons'

type Item = { href: string; label: string; icon: string; perm?: string }
const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'مرور', items: [
    { href: '/dashboard', label: 'داشبورد', icon: 'home' },
  ] },
  { title: 'افراد', items: [
    { href: '/dashboard/users', label: 'کاربران', icon: 'users', perm: 'users.read' },
    { href: '/dashboard/team', label: 'تیم و دسترسی', icon: 'shield', perm: 'admin.manage' },
    { href: '/dashboard/plans', label: 'پلن‌ها', icon: 'card', perm: 'plans.manage' },
    { href: '/dashboard/leads', label: 'درخواست‌ها', icon: 'inbox', perm: 'users.read' },
  ] },
  { title: 'تحلیل', items: [
    { href: '/dashboard/pilot', label: 'پایلوت', icon: 'flask', perm: 'analytics.view' },
    { href: '/dashboard/audit', label: 'فعالیت‌ها', icon: 'scroll', perm: 'audit.read' },
  ] },
  { title: 'محتوا', items: [
    { href: '/dashboard/lessons', label: 'درس‌ها', icon: 'folder', perm: 'content.read' },
    { href: '/dashboard/stories', label: 'داستان‌ها', icon: 'book', perm: 'content.read' },
    { href: '/dashboard/words', label: 'کلمات', icon: 'pencil', perm: 'content.read' },
    { href: '/dashboard/word-images', label: 'تصویر کلمات', icon: 'image', perm: 'content.read' },
    { href: '/dashboard/story-covers', label: 'تصویر جلد داستان‌ها', icon: 'image', perm: 'content.read' },
    { href: '/dashboard/letters', label: 'حروف', icon: 'type', perm: 'content.read' },
    { href: '/dashboard/audio', label: 'صداها', icon: 'volume', perm: 'ai.manage' },
    { href: '/dashboard/characters', label: 'شخصیت‌ها', icon: 'smile', perm: 'content.read' },
  ] },
  { title: 'سیستم', items: [
    { href: '/dashboard/ai', label: 'هوش مصنوعی', icon: 'flask', perm: 'ai.manage' },
  ] },
]
const has = (perms: string[], p?: string) => !p || perms.includes('*') || perms.includes(p)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [perms, setPerms] = useState<string[]>([])
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return }
    api.get<{ admin: boolean; email: string; permissions: string[] }>('/api/admin/me').then(res => {
      if (res.error || !res.data?.admin) router.replace('/login')
      else { setPerms(res.data.permissions ?? []); setEmail(res.data.email ?? ''); setAuthorized(true) }
    })
  }, [router])

  if (!authorized) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <span className="w-5 h-5 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
    </div>
  )

  const groups = GROUPS.map(g => ({ ...g, items: g.items.filter(i => has(perms, i.perm)) })).filter(g => g.items.length)
  const active = GROUPS.flatMap(g => g.items).find(i => i.href === pathname)

  return (
    <div className="min-h-screen bg-slate-50 flex" dir="rtl">
      <aside className="w-60 bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-slate-100">
          <h1 className="font-bold text-lg text-amber-600">KoodakBook</h1>
          <p className="text-xs text-slate-400">پنل مدیریت</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {groups.map(g => (
            <div key={g.title}>
              <p className="text-[11px] font-semibold text-slate-300 px-3 mb-1">{g.title}</p>
              <div className="space-y-0.5">
                {g.items.map(item => {
                  const on = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        on ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <Icon name={item.icon} size={17} className={on ? 'text-amber-600' : 'text-slate-400'} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="px-3 pb-2 text-[11px] text-slate-400 ltr truncate">{email}</div>
          <button onClick={() => { clearToken(); router.push('/login') }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition">
            <Icon name="logout" size={17} /> خروج
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-600">{active?.label ?? 'پنل مدیریت'}</h2>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
