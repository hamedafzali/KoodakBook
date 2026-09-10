'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { clearToken, lockParent } from '@/lib/auth'
import { getActiveChildId, setActiveChildId } from '@/lib/activeChild'
import type { Child, AppCharacter } from '@koodakbook/shared'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import { TRANSLATION_LANGS } from '@koodakbook/shared'
import { getTranslationLang, setTranslationLang } from '@/lib/translation'
import { containerWidths } from '@/components/shared/layout'
import { Icon } from '@/components/icons'
import { PageHeader, Group, NavRow } from '@/components/parent/flat'

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
  /* Voice recording is off until the parent turns it on. Unlike every other
   * setting on this page it is not a preference stored in localStorage — it is
   * consent to store a child's voice, so it lives on the account (mig 061) and
   * the API refuses to accept audio without it. */
  const [voiceConsent, setVoiceConsent] = useState<string | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)

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
    api.get<{ consented_at: string | null }>('/api/read-aloud/consent').then(res => {
      setVoiceConsent(res.data?.consented_at ?? null)
    })
  }, [])

  async function toggleVoice(on: boolean) {
    setVoiceBusy(true)
    const r = await api.patch<{ consented_at: string | null }>('/api/read-aloud/consent', { consent: on })
    setVoiceBusy(false)
    if (!r.error) setVoiceConsent(r.data?.consented_at ?? null)
  }

  // Kid-login username per child (mig 039): the child types just this on the
  // «ورود بچه‌ها» screen. Future: face detection replaces the typing.
  const [unameDraft, setUnameDraft] = useState<Record<string, string>>({})
  const [unameMsg, setUnameMsg] = useState<Record<string, string>>({})
  async function saveUsername(id: string) {
    const v = (unameDraft[id] ?? '').trim().toLowerCase()
    const r = await api.patch<Child>(`/api/children/${id}`, { username: v })
    if (r.error) { setUnameMsg(m => ({ ...m, [id]: r.error! })); return }
    setUnameMsg(m => ({ ...m, [id]: v ? `ذخیره شد — کودک با «${v}» وارد می‌شود` : 'حذف شد' }))
    setChildren(cs => cs.map(c => (c.id === id ? { ...c, username: v || null } : c)))
  }

  // Picture password (mig 059): an alternative to typing the username, for a
  // child who can't read/type reliably. 3 character taps, in order.
  const [pwOpenFor, setPwOpenFor] = useState<string | null>(null)
  const [pwCharacters, setPwCharacters] = useState<AppCharacter[]>([])
  const [pwPicked, setPwPicked] = useState<string[]>([])
  const [pwMsg, setPwMsg] = useState<Record<string, string>>({})

  async function openPicturePassword(id: string) {
    setPwOpenFor(id); setPwPicked([]); setPwMsg(m => ({ ...m, [id]: '' }))
    if (pwCharacters.length === 0) {
      const r = await api.get<AppCharacter[]>('/api/characters')
      setPwCharacters(r.data ?? [])
    }
  }

  async function pickForPicturePassword(id: string, slug: string) {
    const next = [...pwPicked, slug]
    setPwPicked(next)
    if (next.length < 3) return
    const r = await api.patch<Child>(`/api/children/${id}/picture-password`, { slugs: next })
    setPwPicked([])
    if (r.error) { setPwMsg(m => ({ ...m, [id]: r.error! })); return }
    setPwMsg(m => ({ ...m, [id]: 'ذخیره شد' }))
    setPwOpenFor(null)
    setChildren(cs => cs.map(c => (c.id === id ? { ...c, picture_password: next } : c)))
  }

  async function clearPicturePassword(id: string) {
    const r = await api.patch<Child>(`/api/children/${id}/picture-password`, { slugs: null })
    if (r.error) { setPwMsg(m => ({ ...m, [id]: r.error! })); return }
    setPwMsg(m => ({ ...m, [id]: 'حذف شد' }))
    setChildren(cs => cs.map(c => (c.id === id ? { ...c, picture_password: null } : c)))
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
      <div className={`min-h-screen bg-parent-bg ${containerWidths.app}`}>
        <PageHeader title="تنظیمات" back="/parent/dashboard" backLabel="برگشت به داشبورد" />

        <div className="px-4 pt-5 space-y-4">

          {/* Learning settings */}
          <Group title="تنظیمات یادگیری" id="learning-settings-title">

              {/* Daily goal */}
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="font-medium text-parent-text mb-3 text-sm">هدف روزانه</p>
                <div className="flex gap-2 flex-wrap">
                  {DAILY_GOALS.map(g => (
                    <button
                      key={g.value}
                      onClick={() => handleGoalChange(g.value)}
                      aria-pressed={dailyGoal === g.value}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[36px] ${
                        dailyGoal === g.value
                          ? 'text-white'
                          : 'bg-slate-100 text-parent-text hover:bg-slate-200'
                      }`}
                      style={dailyGoal === g.value ? { background: 'var(--ramp-brand-bright)' } : undefined}
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
                  <p className="font-medium text-parent-text text-sm">زبان ترجمه‌ی داستان‌ها</p>
                  <p className="text-xs text-parent-muted mt-0.5">زیر متن فارسی نمایش داده می‌شود</p>
                </div>
                <select
                  value={transLang}
                  onChange={e => handleLangChange(e.target.value)}
                  aria-label="زبان ترجمه"
                  className="shrink-0 min-h-[44px] border border-slate-200 rounded-xl px-3 py-2 text-sm bg-parent-surface text-parent-text focus:outline-none focus:ring-2"
                >
                  <option value="none">خاموش</option>
                  {TRANSLATION_LANGS.map(l => (
                    <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                  ))}
                </select>
              </div>
          </Group>

          {/* Voice recording — its own section, not a row inside «تنظیمات
              یادگیری». Consent to record a child is not the same kind of
              decision as picking a daily goal, and burying it next to one
              would misrepresent what is being agreed to. */}
          <Group title="صدای کودک" id="voice-settings-title">
              <div className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-parent-text text-sm">ضبط صدای کتاب‌خواندن</p>
                  <p className="text-xs text-parent-muted mt-1 leading-relaxed">
                    بعد از هر داستان، کودک می‌تواند آن را با صدای خودش بخواند و شما بعداً گوش بدهید.
                  </p>
                  {/* Everything the parent is agreeing to, stated before they
                      agree — not in a privacy page they will never open. */}
                  <ul className="text-xs text-parent-muted mt-2 space-y-1 leading-relaxed list-disc pr-4">
                    <li>صداها فقط برای شما پخش می‌شود و برای کسی فرستاده نمی‌شود.</li>
                    <li>هر ضبط پس از ۳۰ روز خودکار پاک می‌شود، مگر آن را نگه دارید.</li>
                    <li>هر وقت خاموش کنید، ضبط تازه انجام نمی‌شود.</li>
                  </ul>
                </div>
                <button
                  role="switch"
                  aria-checked={!!voiceConsent}
                  aria-label="ضبط صدای کتاب‌خواندن"
                  disabled={voiceBusy}
                  onClick={() => toggleVoice(!voiceConsent)}
                  className={`shrink-0 w-[52px] h-[32px] rounded-full p-1 transition-colors disabled:opacity-50 ${
                    voiceConsent ? 'btn-brand' : 'bg-slate-400'
                  }`}
                >
                  {/* slate-400, not slate-300: "off" still has to be visible
                      against a white card, and the old track was 1.6:1. */}
                  <span className={`block w-6 h-6 rounded-full bg-white shadow-card transition-transform ${
                    voiceConsent ? '-translate-x-5' : ''
                  }`} />
                </button>
              </div>
              {voiceConsent && (
                <div className="border-t border-slate-100">
                  <NavRow label="صداهای ضبط‌شده" href="/parent/recordings" />
                </div>
              )}
          </Group>

          {/* Children */}
          <Group title="کودکان" id="children-title" className="divide-y divide-slate-100">
              {children.map(c => (
                <div key={c.id} className="px-5 py-4">
                  <button
                    onClick={() => chooseChild(c.id)}
                    className="w-full flex items-center justify-between text-right min-h-[32px]"
                    aria-pressed={c.id === activeId}
                  >
                    <span className="font-medium text-parent-text text-sm">{c.name}</span>
                    {c.id === activeId
                      ? <span className="text-xs text-white px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--ramp-brand-bright)' }}>فعال</span>
                      : <span className="text-xs text-parent-muted">انتخاب</span>}
                  </button>
                  {/* Kid-login username: the child types just this on «ورود بچه‌ها» */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-parent-muted shrink-0">اسم ورود کودک:</span>
                    <input
                      value={unameDraft[c.id] ?? c.username ?? ''}
                      onChange={e => setUnameDraft(d => ({ ...d, [c.id]: e.target.value }))}
                      placeholder="مثلاً sara2018"
                      dir="ltr"
                      className="ltr flex-1 min-w-0 min-h-[36px] bg-parent-surface text-parent-text border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2"
                    />
                    <button onClick={() => saveUsername(c.id)}
                      className="text-xs font-bold rounded-lg px-3 py-1.5 min-h-[36px] shrink-0"
                      style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }}>
                      ذخیره
                    </button>
                  </div>
                  {unameMsg[c.id] && <p aria-live="polite" className="text-[11px] text-parent-muted mt-1">{unameMsg[c.id]}</p>}

                  {/* Picture password (mig 059): 3-tap alternative to typing
                      the username above — for a child who can't type/read
                      reliably. First time on a new device still needs one
                      parent PIN check (design: docs/child-login-security.md). */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-parent-muted">رمز تصویری (۳ شخصیت):</span>
                      {c.picture_password ? (
                        <button onClick={() => clearPicturePassword(c.id)}
                          className="text-xs font-bold text-parent-muted hover:text-rose-700 min-h-[36px] px-2">حذف</button>
                      ) : (
                        <button onClick={() => openPicturePassword(c.id)}
                          className="text-xs font-bold rounded-lg px-3 py-1.5 min-h-[36px]"
                          style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }}>
                          تنظیم رمز تصویری
                        </button>
                      )}
                    </div>
                    {pwMsg[c.id] && <p aria-live="polite" className="text-[11px] text-parent-muted mt-1">{pwMsg[c.id]}</p>}

                    {pwOpenFor === c.id && (
                      <div className="mt-3">
                        <p className="text-[11px] text-parent-muted mb-2">
                          ۳ شخصیت را به ترتیبی که کودک باید بزند لمس کنید ({pwPicked.length}/۳)
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                          {pwCharacters.map(ch => (
                            <button
                              key={ch.slug}
                              onClick={() => pickForPicturePassword(c.id, ch.slug)}
                              disabled={pwPicked.includes(ch.slug)}
                              className="bg-parent-bg rounded-xl p-1 hover:brightness-95 disabled:opacity-30 transition-all"
                              aria-label={ch.name_persian}
                            >
                              <CharacterAvatar slug={ch.slug} size={44} />
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setPwOpenFor(null)}
                          className="mt-2 min-h-[36px] text-[11px] text-parent-muted hover:text-parent-text">انصراف</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <NavRow label="گفت‌وگوهای کودک با شخصیت‌ها" href="/parent/conversations" />
              <NavRow label="افزودن کودک" href="/onboarding" tone="brand" />
          </Group>

          {/* Subscription */}
          <Group title="اشتراک" id="plan-section-title">
            <NavRow label="پلن و اشتراک" href="/parent/plan" />
          </Group>

          {/* Account settings */}
          <Group title="حساب کاربری" id="account-settings-title" className="divide-y divide-slate-100">
              {email && (
                <div className="flex items-center gap-3 px-5 py-4">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }} aria-hidden="true">
                    {email[0].toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-parent-muted">وارد شده به عنوان</p>
                    <p className="font-medium text-parent-text text-sm truncate ltr text-left" dir="ltr">{email}</p>
                  </div>
                </div>
              )}
              <NavRow label="تغییر پین والدین" onClick={resetParentPin} />

              {!logoutConfirm ? (
                <button
                  onClick={() => setLogoutConfirm(true)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-rose-50 transition-colors text-rose-700 text-right min-h-[56px]"
                >
                  <span className="font-medium text-sm">خروج از حساب</span>
                  <Icon name="logout" size="sm" />
                </button>
              ) : (
                <div className="px-5 py-4">
                  <p className="text-sm text-parent-text mb-3 persian-text">مطمئنید که می‌خواهید خارج شوید؟</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleLogout}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]"
                    >
                      بله، خروج
                    </button>
                    <button
                      onClick={() => setLogoutConfirm(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-parent-text font-bold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}
          </Group>

          <p className="text-center text-xs text-parent-muted pb-8">KoodakBook v0.1.0</p>
        </div>
      </div>
  )
}
