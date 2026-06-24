'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

interface Role { id: string; key: string; name: string; description: string | null; permissions: string[] }
interface Admin { id: string; email: string; created_at: string; roles: string[] }
interface AdminsResp { owner_email: string; admins: Admin[] }
interface Perm { key: string; description: string | null }

export default function TeamPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [perms, setPerms] = useState<Perm[]>([])
  const [data, setData] = useState<AdminsResp | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newRoles, setNewRoles] = useState<string[]>([])
  const [temp, setTemp] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [r, p, a] = await Promise.all([
      api.get<Role[]>('/api/admin/roles'),
      api.get<Perm[]>('/api/admin/permissions'),
      api.get<AdminsResp>('/api/admin/admins'),
    ])
    if (r.data) setRoles(r.data)
    if (p.data) setPerms(p.data)
    if (a.data) setData(a.data)
  }, [])
  useEffect(() => { load() }, [load])

  function toggle(list: string[], v: string, set: (x: string[]) => void) {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  }

  async function createAdmin() {
    setMsg(null); setTemp(null)
    if (!newEmail || newRoles.length === 0) { setMsg('ایمیل و حداقل یک نقش لازم است'); return }
    const r = await api.post<{ temp_password: string | null }>('/api/admin/admins', { email: newEmail, roles: newRoles })
    if (r.error) { setMsg(`خطا: ${r.error}`); return }
    if (r.data?.temp_password) setTemp(r.data.temp_password)
    setNewEmail(''); setNewRoles([]); load()
  }
  async function setAdminRoles(id: string, rkeys: string[]) {
    await api.patch(`/api/admin/admins/${id}/roles`, { roles: rkeys }); load()
  }
  async function revoke(id: string) {
    if (!confirm('دسترسی این ادمین حذف شود؟')) return
    await api.delete(`/api/admin/admins/${id}`); load()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">تیم و دسترسی</h2>

      {/* Current admins */}
      <section>
        <h3 className="font-bold text-gray-700 mb-2 text-sm">ادمین‌ها</h3>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="ltr text-gray-800 font-medium">{data?.owner_email}</span>
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">مالک (superadmin)</span>
          </div>
          {data?.admins.map(a => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="ltr text-gray-800">{a.email}</span>
                <button onClick={() => revoke(a.id)} className="text-xs text-red-500 hover:underline">حذف دسترسی</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {roles.map(r => (
                  <label key={r.key} className={`text-xs px-2 py-1 rounded-lg cursor-pointer border ${a.roles.includes(r.key) ? 'bg-amber-50 border-amber-300 text-amber-800' : 'border-gray-200 text-gray-500'}`}>
                    <input type="checkbox" className="hidden" checked={a.roles.includes(r.key)}
                      onChange={() => setAdminRoles(a.id, a.roles.includes(r.key) ? a.roles.filter(x => x !== r.key) : [...a.roles, r.key])} />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {data && data.admins.length === 0 && <div className="px-4 py-4 text-sm text-gray-400">ادمین دیگری اضافه نشده</div>}
        </div>
      </section>

      {/* Add admin */}
      <section>
        <h3 className="font-bold text-gray-700 mb-2 text-sm">افزودن ادمین</h3>
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ایمیل" dir="ltr"
            className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            {roles.map(r => (
              <label key={r.key} className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer border ${newRoles.includes(r.key) ? 'bg-amber-50 border-amber-300 text-amber-800' : 'border-gray-200 text-gray-500'}`}>
                <input type="checkbox" className="hidden" checked={newRoles.includes(r.key)} onChange={() => toggle(newRoles, r.key, setNewRoles)} />
                {r.name}
              </label>
            ))}
          </div>
          <button onClick={createAdmin} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2 rounded-xl text-sm">افزودن</button>
          {msg && <p className="text-sm text-red-500">{msg}</p>}
          {temp && <p className="text-sm bg-amber-50 text-amber-800 rounded-xl p-3">رمز موقت (یک‌بار): <b className="ltr">{temp}</b></p>}
        </div>
      </section>

      {/* Roles → permissions reference */}
      <section>
        <h3 className="font-bold text-gray-700 mb-2 text-sm">نقش‌ها و دسترسی‌ها</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {roles.map(r => (
            <div key={r.key} className="bg-white rounded-2xl shadow-sm p-4">
              <p className="font-bold text-gray-800">{r.name} <span className="text-xs text-gray-400 ltr">({r.key})</span></p>
              {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {r.permissions.includes('*') ? <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">همه دسترسی‌ها</span>
                  : r.permissions.map(p => <span key={p} className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded ltr">{p}</span>)}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">{perms.length} دسترسی تعریف‌شده</p>
      </section>
    </div>
  )
}
