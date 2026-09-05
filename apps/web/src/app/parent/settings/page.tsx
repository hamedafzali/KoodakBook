'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { clearToken, lockParent } from '@/lib/auth'
import { getActiveChildId, setActiveChildId } from '@/lib/activeChild'
import type { Child } from '@koodakbook/shared'
import { TRANSLATION_LANGS } from '@koodakbook/shared'
import { getTranslationLang, setTranslationLang } from '@/lib/translation'
import { containerWidths } from '@/components/shared/layout'

const GOAL_KEY = 'koodakbook_daily_goal_min'

const DAILY_GOALS = [
  { value: 5,  label: '۵ دقیقه' },
  { value: 10, label: '۱۰ دقیقه' },
  { value: 15, label: '۱۵ دقیقه' },
  { value: 20, label: '۲۰ دقیقه' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [dailyGoal, setDailyGoal] = useState<number>(10)
  const [transLang, setTransLang] = useState('en')
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [children, setChildren] = useState<Child[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(GOAL_KEY)
    if (stored) setDailyGoal(parseInt(stored))
    setTransLang(getTranslationLang())
    setActiveId(getActiveChildId())
    api.get<Child[]>('/api/children').then(res => {
      if (res.data) {
        setChildren(res.data)
        if (!getActiveChildId() && res.data[0]) setActiveId(res.data[0].id)
      }
    })
    api.get<{ email: string }>('/api/auth/me').then(res => {
      if (res.data?.email) setEmail(res.data.email)
    })
  }, [])

  // Kid-login username per child (mig 039): the child types just this on the
  // «ورود بچه‌ها» screen. Future: face detection replaces the typing.
  const [unameDraft, setUnameDraft] = useState<Record<string, string>>({})
  const [unameMsg, setUnameMsg] = useState<Record<string, string>>({})
  async function saveUsername(id: string) {
    const v = (unameDraft[id] ?? '').trim().toLowerCase()
    const r = await api.patch<Child>(`/api/children/${id}`, { username: v })
    if (r.error) { setUnameMsg(m => ({ ...m, [id]: r.error! })); return }
    setUnameMsg(m => ({ ...m, [id]: v ? `ذخیره شد ✅ — کودک با «${v}» وارد می‌شود` : 'حذف شد' }))
    setChildren(cs => cs.map(c => (c.id === id ? { ...c, username: v || null } : c)))
  }

  function chooseChild(id: string) {
    setActiveChildId(id)
    setActiveId(id)
  }

  function handleGoalChange(val: number) {
    setDailyGoal(val)
    localStorage.setItem(GOAL_KEY, String(val))
  }

  function handleLangChange(code: string) {
    setTransLang(code)
    setTranslationLang(code)
  }

  async function handleLogout() {
    await api.post('/api/auth/logout', {})
    clearToken()
    router.push('/login')
  }

  // Change PIN: re-lock the parent area and open the gate directly in reset mode
  // (verify account password → set a new PIN). The PIN now lives on the server.
  function resetParentPin() {
    lockParent()
    router.push('/parent/dashboard?pin=reset')
  }

  return (
      <div className={`min-h-screen bg-slate-50 ${containerWidths.app}`}>

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center gap-3">
          <Link
            href="/parent/dashboard"
            aria-label="برگشت به داشبورد"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
          <h1 className="font-bold text-xl text-slate-800">تنظیمات</h1>
        </div>

        <div className="px-4 pt-5 space-y-4">

          {/* Learning settings */}
          <section aria-labelledby="learning-settings-title">
            <h2 id="learning-settings-title" className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">تنظیمات یادگیری</h2>
            <div className="bg-white rounded-md shadow-sm overflow-hidden">

              {/* Daily goal */}
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="font-medium text-slate-800 mb-3 text-sm">هدف روزانه</p>
                <div className="flex gap-2 flex-wrap">
                  {DAILY_GOALS.map(g => (
                    <button
                      key={g.value}
                      onClick={() => handleGoalChange(g.value)}
                      aria-pressed={dailyGoal === g.value}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[36px] ${
                        dailyGoal === g.value
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Translation language — the family's language shown under the
                  Persian story text (or off). Non-English are translated on
                  demand and cached. */}
              <div className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm">زبان ترجمه‌ی داستان‌ها</p>
                  <p className="text-xs text-slate-400 mt-0.5">زیر متن فارسی نمایش داده می‌شود</p>
                </div>
                <select
                  value={transLang}
                  onChange={e => handleLangChange(e.target.value)}
                  aria-label="زبان ترجمه"
                  className="shrink-0 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-amber-400"
                >
                  <option value="none">خاموش</option>
                  {TRANSLATION_LANGS.map(l => (
                    <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Children */}
          <section aria-labelledby="children-title">
            <h2 id="children-title" className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">کودکان</h2>
            <div className="bg-white rounded-md shadow-sm divide-y divide-slate-100">
              {children.map(c => (
                <div key={c.id} className="px-5 py-4">
                  <button
                    onClick={() => chooseChild(c.id)}
                    className="w-full flex items-center justify-between text-right min-h-[32px]"
                    aria-pressed={c.id === activeId}
                  >
                    <span className="font-medium text-slate-800 text-sm">{c.name}</span>
                    {c.id === activeId
                      ? <span className="text-xs text-white bg-amber-500 px-2 py-0.5 rounded-full">فعال</span>
                      : <span className="text-xs text-slate-400">انتخاب</span>}
                  </button>
                  {/* Kid-login username: the child types just this on «ورود بچه‌ها» */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 shrink-0">اسم ورود کودک:</span>
                    <input
                      value={unameDraft[c.id] ?? c.username ?? ''}
                      onChange={e => setUnameDraft(d => ({ ...d, [c.id]: e.target.value }))}
                      placeholder="مثلاً sara2018"
                      dir="ltr"
                      className="ltr flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400"
                    />
                    <button onClick={() => saveUsername(c.id)}
                      className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg px-3 py-1.5 shrink-0">
                      ذخیره
                    </button>
                  </div>
                  {unameMsg[c.id] && <p className="text-[11px] text-slate-500 mt-1">{unameMsg[c.id]}</p>}
                </div>
              ))}
              <Link
                href="/parent/conversations"
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors min-h-[56px]"
              >
                <span className="font-medium text-slate-800 text-sm">گفت‌وگوهای کودک با شخصیت‌ها 💬</span>
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <Link
                href="/onboarding"
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors min-h-[56px] text-amber-700"
              >
                <span className="font-medium text-sm">+ افزودن کودک</span>
                <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            </div>
          </section>

          {/* Subscription */}
          <section aria-labelledby="plan-section-title">
            <h2 id="plan-section-title" className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">اشتراک</h2>
            <div className="bg-white rounded-md shadow-sm">
              <Link
                href="/parent/plan"
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors min-h-[56px]"
              >
                <span className="font-medium text-slate-800 text-sm">پلن و اشتراک</span>
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            </div>
          </section>

          {/* Account settings */}
          <section aria-labelledby="account-settings-title">
            <h2 id="account-settings-title" className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">حساب کاربری</h2>
            <div className="bg-white rounded-md shadow-sm divide-y divide-slate-100">
              {email && (
                <div className="flex items-center gap-3 px-5 py-4">
                  <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold shrink-0" aria-hidden="true">
                    {email[0].toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">وارد شده به عنوان</p>
                    <p className="font-medium text-slate-800 text-sm truncate ltr text-left" dir="ltr">{email}</p>
                  </div>
                </div>
              )}
              <button
                onClick={resetParentPin}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-right min-h-[56px]"
              >
                <span className="font-medium text-slate-800 text-sm">تغییر پین والدین</span>
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {!logoutConfirm ? (
                <button
                  onClick={() => setLogoutConfirm(true)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50 transition-colors text-red-500 text-right min-h-[56px]"
                >
                  <span className="font-medium text-sm">خروج از حساب</span>
                  <span aria-hidden="true">🚪</span>
                </button>
              ) : (
                <div className="px-5 py-4">
                  <p className="text-sm text-slate-600 mb-3 persian-text">مطمئنید که می‌خواهید خارج شوید؟</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleLogout}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]"
                    >
                      بله، خروج
                    </button>
                    <button
                      onClick={() => setLogoutConfirm(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <p className="text-center text-xs text-slate-400 pb-8">KoodakBook v0.1.0</p>
        </div>
      </div>
  )
}
