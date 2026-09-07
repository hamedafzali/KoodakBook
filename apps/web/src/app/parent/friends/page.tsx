'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { containerWidths } from '@/components/shared/layout'
import type { Child } from '@koodakbook/shared'

/**
 * Friends (parent view) — port of mobile's app/parent/friends.tsx. Children
 * connect only via a shared code with parent approval: no search, no
 * strangers, no chat. Each child has a code to share; entering a friend's
 * code sends a request the other parent approves. Distinct from
 * /parent/conversations (AI-character chat transcripts) — this is
 * child-to-child friend requests, backed by routes/friends.ts.
 */
interface FriendReq { id: string; requester_name: string; addressee_child_id: string; addressee_name: string }
interface Friend { id: string; name: string; avatar_url: string | null }

export default function ParentFriendsPage() {
  const router = useRouter()
  const [children, setChildren] = useState<Child[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendReq[]>([])
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const loadForChild = useCallback(async (childId: string) => {
    setCode(null)
    const [codeRes, friendsRes] = await Promise.all([
      api.get<{ code: string }>(`/api/friends/code/${childId}`),
      api.get<Friend[]>(`/api/friends/of/${childId}`),
    ])
    if (codeRes.data) setCode(codeRes.data.code)
    setFriends(friendsRes.data ?? [])
  }, [])

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [childRes, reqRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<FriendReq[]>('/api/friends/requests'),
      ])
      const list = childRes.data ?? []
      setChildren(list)
      setRequests(reqRes.data ?? [])
      const active = list[0]?.id ?? null
      setSelected(active)
      if (active) await loadForChild(active)
      setLoading(false)
    }
    load()
  }, [router, loadForChild])

  async function pickChildTab(id: string) {
    setSelected(id)
    setMsg(null)
    await loadForChild(id)
  }

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setMsg({ ok: true, text: 'کد کپی شد ✅' })
    } catch { /* clipboard unavailable — code is still visible to copy by hand */ }
  }

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const c = input.trim().toUpperCase()
    if (!c) return
    setMsg(null)
    const res = await api.post<{ friend_name: string; accepted: boolean }>('/api/friends/request', { child_id: selected, code: c })
    if (res.data) {
      setInput('')
      setMsg({ ok: true, text: res.data.accepted ? `${res.data.friend_name} حالا دوست است! ✅` : `درخواست برای ${res.data.friend_name} فرستاده شد ✅` })
      if (res.data.accepted) await loadForChild(selected)
    } else {
      setMsg({ ok: false, text: res.error ?? 'خطا' })
    }
  }

  async function respond(id: string, accept: boolean) {
    await api.post(`/api/friends/requests/${id}/${accept ? 'accept' : 'decline'}`, {})
    setRequests(r => r.filter(x => x.id !== id))
    if (accept && selected) await loadForChild(selected)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-gray-400 persian-text">در حال بارگذاری...</div>
    </div>
  )

  const activeChild = children.find(c => c.id === selected)

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 ${containerWidths.app}`}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center gap-3">
        <Link
          href="/parent/dashboard"
          aria-label="برگشت"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <div>
          <h1 className="font-bold text-xl text-slate-800">دوستان 🤝</h1>
          <p className="text-sm text-slate-500 mt-0.5">فقط با کد و تأیید شما — بدون غریبه</p>
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-4">
        {!activeChild ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="text-6xl">👶</div>
            <p className="text-gray-600 font-medium persian-text">هنوز پروفایل کودکی ایجاد نشده</p>
          </div>
        ) : (
          <>
            {children.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="انتخاب کودک">
                {children.map(c => (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={c.id === selected}
                    onClick={() => pickChildTab(c.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      c.id === selected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* This child's code */}
            <section className="bg-white rounded-md p-4 shadow-sm text-center" aria-labelledby="code-title">
              <h2 id="code-title" className="font-bold text-slate-700 text-sm mb-2">کد دوستی {activeChild.name}</h2>
              <p className="text-3xl font-bold text-amber-600 tracking-[0.3em] ltr" dir="ltr">{code ?? '…'}</p>
              <button
                onClick={copyCode}
                className="mt-3 w-full sm:w-auto sm:mx-auto sm:px-8 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold py-2.5 rounded-xl transition-colors"
              >
                کپی کد 📋
              </button>
              <p className="text-xs text-slate-400 mt-2 persian-text">این کد را به خانواده‌ی دوستِ کودک بدهید</p>
            </section>

            {/* Add a friend by code */}
            <section className="bg-white rounded-md p-4 shadow-sm" aria-labelledby="add-title">
              <h2 id="add-title" className="font-bold text-slate-700 text-sm mb-2">افزودن دوست با کد</h2>
              <form onSubmit={sendRequest} className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="KB-XXXXX"
                  dir="ltr"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="ltr flex-1 min-w-0 text-center font-bold tracking-widest border-2 border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400"
                />
                <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 rounded-xl transition-colors">
                  ارسال
                </button>
              </form>
              {msg && <p className={`text-sm mt-2 persian-text ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}
            </section>

            {/* Incoming requests */}
            {requests.length > 0 && (
              <section className="bg-white rounded-md p-4 shadow-sm" aria-labelledby="requests-title">
                <h2 id="requests-title" className="font-bold text-slate-700 text-sm mb-3">درخواست‌های دوستی</h2>
                <div className="space-y-3">
                  {requests.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                      <p className="text-sm text-slate-600 persian-text">«{r.requester_name}» می‌خواهد دوستِ {r.addressee_name} شود</p>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => respond(r.id, true)} className="bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition-colors">تأیید</button>
                        <button onClick={() => respond(r.id, false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold px-4 py-1.5 rounded-lg transition-colors">رد</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Friends list */}
            <section className="bg-white rounded-md p-4 shadow-sm" aria-labelledby="friends-title">
              <h2 id="friends-title" className="font-bold text-slate-700 text-sm mb-3">دوستانِ {activeChild.name}</h2>
              {friends.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4 persian-text">هنوز دوستی اضافه نشده — کد را به هم بدهید تا با هم بازی کنند</p>
              ) : (
                <div className="space-y-2">
                  {friends.map(f => (
                    <div key={f.id} className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">🧒</span>
                      <span className="flex-1 font-bold text-slate-700 text-sm">{f.name}</span>
                      <span className="text-xs text-slate-400">بازی آنلاین به‌زودی 🎲</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
