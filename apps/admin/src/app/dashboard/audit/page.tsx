'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { PageHeader, Badge, Spinner } from '@/components/ui'
import { DataTable, type Column } from '@/components/DataTable'

interface Entry {
  admin_email: string
  action: string
  target_type: string | null
  target_id: string | null
  detail: Record<string, unknown>
  created_at: string
}

const ACTION_LABEL: Record<string, string> = {
  'user.plan_change': 'تغییر پلن', 'user.reset_password': 'بازنشانی رمز', 'user.delete': 'حذف خانواده',
  'user.suspend': 'تعلیق', 'user.reactivate': 'فعال‌سازی', 'user.export': 'خروجی داده',
  'admin.create': 'افزودن ادمین', 'admin.set_roles': 'تغییر نقش', 'admin.revoke': 'حذف دسترسی',
  'plan.create': 'ساخت پلن', 'plan.update': 'ویرایش پلن', 'plan.delete': 'حذف پلن',
}

export default function AuditPage() {
  const [rows, setRows] = useState<Entry[] | null>(null)

  useEffect(() => {
    api.get<Entry[]>('/api/admin/audit').then(r => { if (r.data) setRows(r.data) })
  }, [])

  const columns: Column<Entry>[] = [
    { key: 'created_at', header: 'زمان', sortValue: e => new Date(e.created_at).getTime(),
      render: e => <span className="text-slate-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString('fa-IR')}</span> },
    { key: 'admin_email', header: 'ادمین', sortValue: e => e.admin_email,
      render: e => <span className="text-slate-600 ltr">{e.admin_email}</span> },
    { key: 'action', header: 'عملیات', sortValue: e => e.action,
      render: e => <Badge>{ACTION_LABEL[e.action] ?? e.action}</Badge> },
    { key: 'detail', header: 'جزئیات',
      render: e => <span className="text-slate-400 text-xs ltr">{JSON.stringify(e.detail)}</span> },
  ]

  return (
    <div>
      <PageHeader title="گزارش فعالیت ادمین" subtitle="ردگیری همه‌ی عملیات حساس" />
      {!rows ? <Spinner /> : <DataTable rows={rows.map((r, i) => ({ ...r, id: String(i) }))} columns={columns} empty="فعالیتی ثبت نشده" />}
    </div>
  )
}
