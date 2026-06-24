'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Entry {
  admin_email: string
  action: string
  target_type: string | null
  target_id: string | null
  detail: Record<string, unknown>
  created_at: string
}

const ACTION_LABEL: Record<string, string> = {
  'user.plan_change': 'تغییر پلن',
  'user.reset_password': 'بازنشانی رمز',
  'user.delete': 'حذف خانواده',
}

export default function AuditPage() {
  const [rows, setRows] = useState<Entry[] | null>(null)

  useEffect(() => {
    api.get<Entry[]>('/api/admin/audit').then(r => { if (r.data) setRows(r.data) })
  }, [])

  if (!rows) return <p className="text-gray-400">در حال بارگذاری...</p>

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-5">گزارش فعالیت ادمین</h2>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-right px-4 py-3 font-medium">زمان</th>
              <th className="text-right px-4 py-3 font-medium">ادمین</th>
              <th className="text-right px-4 py-3 font-medium">عملیات</th>
              <th className="text-right px-4 py-3 font-medium">جزئیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString('fa-IR')}</td>
                <td className="px-4 py-3 text-gray-600 ltr">{e.admin_email}</td>
                <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{ACTION_LABEL[e.action] ?? e.action}</span></td>
                <td className="px-4 py-3 text-gray-400 text-xs ltr">{JSON.stringify(e.detail)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">فعالیتی ثبت نشده</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
