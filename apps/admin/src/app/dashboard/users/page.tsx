'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

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

export default function UsersPage() {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-800">کاربران {data ? `(${data.total})` : ''}</h2>
        <Link href="/dashboard/audit" className="text-sm text-amber-700 hover:underline">گزارش فعالیت‌ها ←</Link>
      </div>

      <form onSubmit={e => { e.preventDefault(); load(q) }} className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="جستجوی ایمیل…"
          dir="ltr"
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 rounded-xl text-sm">جستجو</button>
      </form>

      {loading ? (
        <p className="text-gray-400">در حال بارگذاری...</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-right px-4 py-3 font-medium">ایمیل</th>
                <th className="px-3 py-3 font-medium">پلن</th>
                <th className="px-3 py-3 font-medium">کودکان</th>
                <th className="px-3 py-3 font-medium">آخرین فعالیت</th>
                <th className="px-3 py-3 font-medium">عضویت</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map(u => (
                <tr key={u.id} className="border-t border-gray-100 hover:bg-amber-50/40">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/users/${u.id}`} className="text-amber-700 hover:underline ltr inline-block">{u.email}</Link>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.plan === 'premium' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>{u.plan}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">{u.children_count}</td>
                  <td className="px-3 py-3 text-center text-gray-500">{fa(u.last_active)}</td>
                  <td className="px-3 py-3 text-center text-gray-500">{fa(u.created_at)}</td>
                </tr>
              ))}
              {data?.users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">کاربری یافت نشد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
