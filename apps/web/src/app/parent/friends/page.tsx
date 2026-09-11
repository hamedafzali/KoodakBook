'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { containerWidths } from '@/components/shared/layout'
import { PageHeader, Panel } from '@/components/parent/flat'
import { Icon } from '@/components/icons'
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
      setMsg({ ok: true, text: 'کد کپی شد' })
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
      setMsg({ ok: true, text: res.data.accepted ? `${res.data.friend_name} حالا دوست است!` : `درخواست برای ${res.data.friend_name} فرستاده شد` })
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
    <div className="min-h-screen flex items-center justify-center bg-parent-bg">
      <div className="text-parent-muted persian-text">در حال بارگذاری...</div>
    </div>
  )

  const activeChild = children.find(c => c.id === selected)

  return (
    <div className={`min-h-screen bg-parent-bg pb-20 ${containerWidths.app}`}>
      {/* The old back chevron here pointed LEFT (`M15 18l-6-6 6-6`) while every
          other parent screen's pointed right. In an RTL app one of the two was
          walking the reader the wrong way; PageHeader settles it on the icon
          set's `back`, which is a right chevron for Persian. */}
      <PageHeader
        title="دوستان"
        subtitle="فقط با کد و تأیید شما — بدون غریبه"
        back="/parent/dashboard"
      />

      <div className="px-4 pt-5 flex flex-col gap-4">
        {!activeChild ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <span
              className="w-16 h-16 rounded-full grid place-items-center"
              style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }}
              aria-hidden="true"
            >
              <Icon name="child" size="xl" />
            </span>
            <p className="text-parent-text font-medium persian-text">هنوز پروفایل کودکی ایجاد نشده</p>
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
                      c.id === selected ? 'text-white' : 'bg-surface-subtle text-parent-text hover:bg-surface-subtle'
                    }`}
                    style={c.id === selected ? { background: 'var(--ramp-brand-bright)' } : undefined}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* This child's code */}
            <Panel className="text-center" title={`کد دوستی ${activeChild.name}`} labelledById="code-title">
              {/* The code is read aloud down a phone line as often as it is
                  copied, so it stays wide-tracked and LTR even in an RTL
                  page — an alphanumeric code reordered by bidi is unreadable. */}
              <p className="text-3xl font-bold tracking-[0.3em] ltr tabular-nums" dir="ltr"
                style={{ color: 'var(--ramp-brand-ink)' }}>{code ?? '…'}</p>
              <button
                onClick={copyCode}
                className="mt-3 min-h-[44px] w-full sm:w-auto sm:mx-auto sm:px-8 font-bold py-2.5 rounded-xl transition-colors"
                style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }}
              >
                کپی کد
              </button>
              <p className="text-xs text-parent-muted mt-2 persian-text">این کد را به خانواده‌ی دوستِ کودک بدهید</p>
            </Panel>

            {/* Add a friend by code */}
            <Panel title="افزودن دوست با کد" labelledById="add-title">
              <form onSubmit={sendRequest} className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="KB-XXXXX"
                  dir="ltr"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="ltr flex-1 min-w-0 min-h-[44px] text-center font-bold tracking-widest bg-parent-surface text-parent-text border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-offset-1"
                />
                <button type="submit"
                  className="min-h-[44px] text-white font-bold px-6 rounded-xl transition-opacity hover:opacity-90"
                  style={{ background: 'var(--ramp-brand-bright)' }}>
                  ارسال
                </button>
              </form>
              {/* aria-live, because the result of sending a code is the only
                  feedback there is and it appears far from the focused field. */}
              <p aria-live="polite" className={`text-sm mt-2 persian-text ${msg?.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {msg?.text}
              </p>
            </Panel>

            {/* Incoming requests */}
            {requests.length > 0 && (
              <Panel title="درخواست‌های دوستی" labelledById="requests-title">
                <div className="space-y-3">
                  {requests.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                      <p className="text-sm text-parent-text persian-text">«{r.requester_name}» می‌خواهد دوستِ {r.addressee_name} شود</p>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => respond(r.id, true)} className="min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 rounded-lg transition-colors">تأیید</button>
                        <button onClick={() => respond(r.id, false)} className="min-h-[40px] bg-surface-subtle hover:bg-surface-subtle text-parent-text text-sm font-bold px-4 rounded-lg transition-colors">رد</button>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Friends list */}
            <Panel title={`دوستانِ ${activeChild.name}`} labelledById="friends-title">
              {friends.length === 0 ? (
                <p className="text-sm text-parent-muted text-center py-4 persian-text">هنوز دوستی اضافه نشده — کد را به هم بدهید تا با هم بازی کنند</p>
              ) : (
                <div className="space-y-2">
                  {friends.map(f => (
                    <div key={f.id} className="flex items-center gap-3">
                      <FriendAvatar name={f.name} src={f.avatar_url} />
                      <span className="flex-1 font-bold text-parent-text text-sm">{f.name}</span>
                      <span className="text-xs text-parent-muted">بازی آنلاین به‌زودی</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}

/* Was a 🧒 emoji for every friend — the same face for all of them, which is
 * the opposite of what an avatar is for. A friend who has a picture gets it;
 * one who doesn't gets their own initial, so the rows are distinguishable at
 * a glance instead of identical. */
function FriendAvatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="w-9 h-9 rounded-full object-cover bg-surface-subtle" />
  }
  return (
    <span
      className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0"
      style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }}
      aria-hidden="true"
    >
      {name.trim().charAt(0)}
    </span>
  )
}
