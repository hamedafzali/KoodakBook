'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { onSignIn } from '@/lib/auth'
import { enterChildMode } from '@/lib/mode'
import { setActiveChildId } from '@/lib/activeChild'
import { getDeviceToken, setDeviceToken } from '@/lib/deviceToken'
import { playTap } from '@/lib/sounds'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import { ClayButton, softClayVars } from '@/components/child/clay'
import type { AppCharacter } from '@koodakbook/shared'
import { Icon } from '@/components/icons'

/* Kid login (mig 059): type your name, then — if a parent set one up — tap
 * your 3-character picture password instead of typing anything else. On an
 * already-bound device that's the whole flow; on a new device, a one-time
 * parent PIN check binds it so future logins here skip straight to the
 * picture step. No picture password set → the original one-tap flow.
 * The same username screen is the future hook point for face recognition
 * («دوربین من را می‌شناسد!»). */

type Step = 'name' | 'picture' | 'parent_pin'

export default function KidLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('name')
  const [username, setUsername] = useState('')
  const [child, setChild] = useState<{ id: string; name: string } | null>(null)
  const [characters, setCharacters] = useState<AppCharacter[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function finishLogin(token: string, childId: string, childName: string, deviceToken?: string) {
    onSignIn(token)
    enterChildMode()
    setActiveChildId(childId)
    if (deviceToken) setDeviceToken(childId, deviceToken)
    router.push('/child/home')
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const r = await api.post<{ token?: string; child_id: string; child_name: string; needs_picture_password?: boolean }>(
      '/api/auth/child-login', { username: username.trim() })
    setLoading(false)
    if (r.error || !r.data) { setError(r.error ?? 'یک مشکلی پیش آمد — دوباره امتحان کن'); return }

    if (r.data.needs_picture_password) {
      setChild({ id: r.data.child_id, name: r.data.child_name })
      const chars = await api.get<AppCharacter[]>('/api/characters')
      setCharacters(chars.data ?? [])
      setStep('picture')
      return
    }
    finishLogin(r.data.token!, r.data.child_id, r.data.child_name)
  }

  async function tapCharacter(slug: string) {
    if (!child || loading) return
    playTap()
    const next = [...picked, slug]
    setPicked(next)
    if (next.length < 3) return

    setLoading(true); setError(null)
    const r = await api.post<{ ok: boolean; locked?: boolean; needs_parent_pin?: boolean; token?: string; child_id: string; child_name: string }>(
      '/api/auth/child-login/verify-picture',
      { child_id: child.id, slugs: next, device_token: getDeviceToken(child.id) ?? undefined }
    )
    setLoading(false)
    if (r.error || !r.data) { setError('یک مشکلی پیش آمد — دوباره امتحان کن'); setPicked([]); return }

    if (!r.data.ok) {
      setPicked([])
      setError(r.data.locked
        ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن'
        : 'ترتیب درست نبود. دوباره امتحان کن')
      return
    }
    if (r.data.needs_parent_pin) {
      setPicked([])
      setStep('parent_pin')
      return
    }
    finishLogin(r.data.token!, r.data.child_id, r.data.child_name)
  }

  async function submitParentPin(e: React.FormEvent) {
    e.preventDefault()
    if (!child) return
    setLoading(true); setError(null)
    const r = await api.post<{ ok: boolean; locked?: boolean; token?: string; device_token?: string; child_id: string; child_name: string }>(
      '/api/auth/child-login/bind-device', { child_id: child.id, pin }
    )
    setLoading(false)
    if (r.error || !r.data) { setError('یک مشکلی پیش آمد — دوباره امتحان کن'); return }
    if (!r.data.ok) {
      setPin('')
      setError(r.data.locked ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن' : 'پین اشتباه است')
      return
    }
    finishLogin(r.data.token!, r.data.child_id, r.data.child_name, r.data.device_token)
  }

  return (
    // The child's front door: the child app's own page (child-bg), display
    // headings and clay buttons, so sign-in -> Home is one visual system
    // (was a sky-to-amber gradient with slate text and a flat gradient button).
    <div className="min-h-screen child-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        {/* initial={false}: the first step renders at full opacity in the
            server HTML. With the steps' `initial={{ opacity: 0 }}` applied on
            first render too, the page was served invisible and only faded in
            once JS had hydrated (a blank page on a slow hard refresh). Steps
            still cross-fade when the child moves between them. */}
        <AnimatePresence mode="wait" initial={false}>
          {step === 'name' && (
            <motion.div key="name" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* سیمرغ, the app's guide, greets the child -- the same host as
                  mobile's login scene and Home's hero (was a 🐣 emoji). */}
              <motion.div
                className="mb-3 flex justify-center select-none"
                animate={{ y: [0, -10, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                <CharacterAvatar slug="simorgh" size={120} />
              </motion.div>
              <h1 className="font-display font-black text-3xl text-text-primary mb-2">سلام! تو کی هستی؟</h1>
              <p className="text-text-secondary persian-text mb-7">اسم مخصوصت را بنویس — همانی که مامان یا بابا برایت ساخته</p>

              <form onSubmit={submitName} className="space-y-4" noValidate>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="sara2018"
                  dir="ltr"
                  autoCapitalize="none"
                  autoComplete="username"
                  className="ltr w-full text-center text-2xl font-bold tracking-wide border-4 border-b-8 border-amber-300 rounded-[1.5rem] px-4 py-4 bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-brand-text min-h-[64px]"
                  aria-label="اسم مخصوص تو"
                />
                {error && <p role="alert" className="text-red-700 text-sm persian-text">{error}</p>}
                <ClayButton type="submit" size="lg" disabled={loading || username.trim().length < 3}>
                  {loading ? 'دارم می‌آیم…' : 'بریم بازی!'}
                </ClayButton>
              </form>

              <p className="text-sm text-text-secondary mt-8 persian-text">
                اسم مخصوص نداری؟ از مامان یا بابا بخواه در تنظیمات برایت بسازد.
              </p>
              <Link href="/login" className="inline-flex items-center min-h-[44px] px-2 mt-2 text-sm font-bold text-text-secondary hover:text-brand-text underline">
                ورود والدین ←
              </Link>
            </motion.div>
          )}

          {step === 'picture' && (
            <motion.div key="picture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="font-display font-black text-2xl text-text-primary mb-1">سلام {child?.name}!</h1>
              <p className="text-text-secondary persian-text mb-2">۳ دوستت را به ترتیب لمس کن</p>

              {/* Picked-so-far strip — lets a child see progress without any text/numbers. */}
              <div className="flex justify-center gap-2.5 mb-5" role="img" aria-label={`${picked.length.toLocaleString('fa-IR')} از ۳`}>
                {[0, 1, 2].map(i => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < picked.length ? 'bg-amber-400 border-amber-700' : 'bg-white border-amber-200'}`} />
                ))}
              </div>

              {error && <p role="alert" className="text-red-700 text-sm persian-text mb-4">{error}</p>}

              <div className="grid grid-cols-3 gap-4">
                {characters.map(c => (
                  <motion.button
                    key={c.slug}
                    onClick={() => tapCharacter(c.slug)}
                    disabled={loading}
                    whileTap={{ scale: 0.9 }}
                    aria-label={c.name_persian}
                    className="clay-option flex items-center justify-center p-2 disabled:opacity-50 touch-target-child"
                    style={softClayVars('review')}
                  >
                    <CharacterAvatar slug={c.slug} size={72} />
                  </motion.button>
                ))}
              </div>

              <button
                onClick={() => { setStep('name'); setPicked([]); setError(null) }}
                className="mt-4 inline-flex items-center min-h-[44px] px-3 text-sm font-bold text-text-secondary hover:text-brand-text underline transition-colors"
              >
                اسم دیگری وارد کنم
              </button>
            </motion.div>
          )}

          {step === 'parent_pin' && (
            <motion.div key="parent_pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-4 flex justify-center text-text-secondary"><Icon name="locked" size={40} /></div>
              <h1 className="font-display font-black text-xl text-text-primary mb-1">این دستگاه جدید است</h1>
              <p className="text-text-secondary persian-text mb-6 text-sm">
                برای اولین ورود {child?.name} روی این دستگاه، از مامان یا بابا بخواه پین را وارد کند
              </p>
              <form onSubmit={submitParentPin} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(null) }}
                  placeholder="••••"
                  dir="ltr"
                  className="ltr w-full text-center text-3xl tracking-[0.5em] border-4 border-b-8 border-amber-300 rounded-[1.5rem] px-4 py-4 bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-brand-text min-h-[64px]"
                  aria-label="پین والدین"
                />
                {error && <p role="alert" className="text-red-700 text-sm persian-text">{error}</p>}
                <ClayButton type="submit" size="lg" disabled={loading || pin.length < 4}>
                  {loading ? '...' : 'تأیید'}
                </ClayButton>
              </form>
              <button
                onClick={() => { setStep('name'); setPin(''); setError(null) }}
                className="mt-4 inline-flex items-center min-h-[44px] px-3 text-sm font-bold text-text-secondary hover:text-brand-text underline transition-colors"
              >
                بازگشت
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
