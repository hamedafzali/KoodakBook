'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { clearToken, lockParent } from '@/lib/auth'
import { getActiveChildId, setActiveChildId } from '@/lib/activeChild'
import type { Child } from '@koodakbook/shared'
import { containerWidths } from '@/components/shared/layout'

const GOAL_KEY = 'koodakbook_daily_goal_min'
const TRANSLATION_KEY = 'koodakbook_show_translation'

const DAILY_GOALS = [
  { value: 5,  label: '۵ دقیقه' },
  { value: 10, label: '۱۰ دقیقه' },
  { value: 15, label: '۱۵ دقیقه' },
  { value: 20, label: '۲۰ دقیقه' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [dailyGoal, setDailyGoal] = useState<number>(10)
  const [showTranslation, setShowTranslation] = useState(true)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [children, setChildren] = useState<Child[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(GOAL_KEY)
    if (stored) setDailyGoal(parseInt(stored))
    const trans = localStorage.getItem(TRANSLATION_KEY)
    if (trans !== null) setShowTranslation(trans === '1')
    setActiveId(getActiveChildId())
    api.get<Child[]>('/api/children').then(res => {
      if (res.data) {
        setChildren(res.data)
        if (!getActiveChildId() && res.data[0]) setActiveId(res.data[0].id)
      }
    })
  }, [])

  function chooseChild(id: string) {
    setActiveChildId(id)
    setActiveId(id)
  }

  function handleGoalChange(val: number) {
    setDailyGoal(val)
    localStorage.setItem(GOAL_KEY, String(val))
  }

  function handleTranslationToggle() {
    setShowTranslation(v => {
      const next = !v
      localStorage.setItem(TRANSLATION_KEY, next ? '1' : '0')
      return next
    })
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

              {/* Translation toggle */}
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800 text-sm">نمایش ترجمه انگلیسی</p>
                  <p className="text-xs text-slate-400 mt-0.5">در داستان‌ها و درس‌ها</p>
                </div>
                <button
                  role="switch"
                  aria-checked={showTranslation}
                  aria-label="نمایش ترجمه انگلیسی"
                  onClick={handleTranslationToggle}
                  className={`w-12 h-7 rounded-full transition-colors relative ${showTranslation ? 'bg-amber-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1.5 w-4 h-4 bg-white rounded-full shadow transition-all ${showTranslation ? 'right-1.5' : 'right-7'}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Children */}
          <section aria-labelledby="children-title">
            <h2 id="children-title" className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">کودکان</h2>
            <div className="bg-white rounded-md shadow-sm divide-y divide-slate-100">
              {children.map(c => (
                <button
                  key={c.id}
                  onClick={() => chooseChild(c.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-right min-h-[56px]"
                  aria-pressed={c.id === activeId}
                >
                  <span className="font-medium text-slate-800 text-sm">{c.name}</span>
                  {c.id === activeId
                    ? <span className="text-xs text-white bg-amber-500 px-2 py-0.5 rounded-full">فعال</span>
                    : <span className="text-xs text-slate-400">انتخاب</span>}
                </button>
              ))}
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
