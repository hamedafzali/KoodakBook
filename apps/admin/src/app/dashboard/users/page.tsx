'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader, Badge, Spinner } from '@/components/ui'
import { DataTable, type Column } from '@/components/DataTable'

interface ParentRow {
  id: string
  email: string
  plan: 'free' | 'premium'
  plan_expires_at: string | null
  created_at: string
  children_count: number
  last_active: string | null
}
interface UsersResp { users: ParentRow[]; total: number; limit: number; offset: number }

const fa = (d: string | null) => (d ? new Date(d).toLocaleDateString('fa-IR') : '—')
const ts = (d: string | null) => (d ? new Date(d).getTime() : 0)

export default function UsersPage() {
  const router = useRouter()
  const [data, setData] = useState<UsersResp | null>(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (query: string) => {
    setLoading(true)
    const r = await api.get<UsersResp>(`/api/admin/users?q=${encodeURIComponent(query)}`)
    if (r.data) setData(r.data)
    setLoading(false)
  }, [])
  useEffect(() => { load('') }, [load])

  const columns: Column<ParentRow>[] = [
    { key: 'email', header: 'ایمیل', sortValue: u => u.email,
      render: u => <Link href={`/dashboard/users/${u.id}`} onClick={e => e.stopPropagation()} className="text-amber-700 hover:underline ltr inline-block">{u.email}</Link> },
    { key: 'plan', header: 'پلن', align: 'center', sortValue: u => u.plan,
      render: u => <Badge tone={u.plan === 'premium' ? 'violet' : 'gray'}>{u.plan}</Badge> },
    { key: 'children_count', header: 'کودکان', align: 'center', sortValue: u => u.children_count,
      render: u => <span className="text-slate-700">{u.children_count}</span> },
    { key: 'last_active', header: 'آخرین فعالیت', align: 'center', sortValue: u => ts(u.last_active),
      render: u => <span className="text-slate-500">{fa(u.last_active)}</span> },
    { key: 'created_at', header: 'عضویت', align: 'center', sortValue: u => ts(u.created_at),
      render: u => <span className="text-slate-500">{fa(u.created_at)}</span> },
  ]

  return (
    <div>
      <PageHeader title={`کاربران${data ? ` (${data.total})` : ''}`} subtitle="خانواده‌های ثبت‌نام‌شده"
        actions={<Link href="/dashboard/audit" className="text-sm text-amber-700 hover:underline">گزارش فعالیت‌ها ←</Link>} />

      <form onSubmit={e => { e.preventDefault(); load(q) }} className="mb-4 flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی ایمیل…" dir="ltr"
          className="flex-1 border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
        <button className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 rounded-xl text-sm">جستجو</button>
      </form>

      {loading ? <Spinner /> : (
        <DataTable rows={data?.users ?? []} columns={columns} onRowClick={u => router.push(`/dashboard/users/${u.id}`)} empty="کاربری یافت نشد" />
      )}
    </div>
  )
}
