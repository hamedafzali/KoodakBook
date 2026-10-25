'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Icon } from '@/components/icons'

/* One feedback form for the website contact section (no account: email
 * required) and the parent area (signed in: the account email is used, no
 * email field). POST /api/feedback (backend routes/feedback.ts). The page /
 * screen and the browser go along as context so a "problem" report is
 * actionable — nothing about the child is ever sent. */

export type FeedbackKind = 'idea' | 'problem' | 'question' | 'other'
export const FEEDBACK_KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'idea', label: 'پیشنهاد' },
  { value: 'problem', label: 'مشکل' },
  { value: 'question', label: 'سؤال' },
  { value: 'other', label: 'پیام دیگر' },
]

const field = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

export default function FeedbackForm({ mode, screen, onSent }: {
  mode: 'public' | 'parent'
  /** Where the form lives, sent as context (e.g. "landing", "parent/feedback"). */
  screen: string
  onSent?: () => void
}) {
  const [kind, setKind] = useState<FeedbackKind>(mode === 'parent' ? 'idea' : 'question')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')   // honeypot
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (message.trim().length < 5) { setErr('لطفاً کمی بیشتر بنویسید'); return }
    setState('busy')
    const r = await api.post('/api/feedback', {
      source: mode === 'parent' ? 'parent_web' : 'site',
      kind,
      message: message.trim(),
      ...(mode === 'public' ? { email: email.trim(), name: name.trim() || undefined, website } : {}),
      context: {
        screen,
        platform: 'web',
        browser: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : '',
      },
    })
    if (r.error) { setErr(r.error); setState('idle'); return }
    setState('done')
    onSent?.()
  }

  if (state === 'done') return (
    <div role="status" className="rounded-2xl bg-green-50 border border-green-200 px-5 py-4 text-sm text-green-800">
      <p className="font-bold inline-flex items-center gap-2"><Icon name="doneCircle" size="sm" /> پیامتان رسید — ممنونیم!</p>
      <p className="mt-1">
        {mode === 'parent'
          ? 'پاسخ ما همین‌جا، زیر «پیام‌های من»، نشان داده می‌شود.'
          : 'اگر پیامتان جواب لازم داشته باشد، به همین ایمیل جواب می‌دهیم.'}
      </p>
      <button type="button" onClick={() => { setMessage(''); setState('idle') }} className="mt-3 text-green-900 font-bold underline">
        پیام دیگری بفرستید
      </button>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="فرستادن پیام">
      <fieldset>
        <legend className="text-sm font-bold text-text-primary mb-2">درباره‌ی چیست؟</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {FEEDBACK_KINDS.map(k => (
            <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)}
              className={`px-4 py-2 rounded-full text-sm font-bold border transition min-h-[44px] ${
                kind === k.value ? 'bg-amber-400 border-amber-500 text-slate-900' : 'bg-white border-slate-200 text-text-secondary hover:border-amber-300'}`}>
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-bold text-text-primary">پیام شما</span>
        <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={2000}
          placeholder={kind === 'problem' ? 'چه شد؟ کجای اپ بودید و انتظار داشتید چه اتفاقی بیفتد؟' : 'هر چیزی که دوست دارید به ما بگویید…'}
          className={`${field} mt-1.5 leading-7`} />
        <span className="block text-xs text-text-secondary mt-1 text-left tabular-nums" dir="ltr">{message.length}/2000</span>
      </label>

      {mode === 'public' && (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-bold text-text-primary">ایمیل <span className="font-normal text-text-secondary">(برای جواب)</span></span>
            <input required type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className={`${field} mt-1.5`} />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-text-primary">نام <span className="font-normal text-text-secondary">(اختیاری)</span></span>
            <input type="text" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={120} className={`${field} mt-1.5`} />
          </label>
          <input type="text" value={website} onChange={e => setWebsite(e.target.value)}
            className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        </div>
      )}

      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === 'busy'}
          className="btn-brand inline-flex items-center gap-2 font-bold px-6 py-3 rounded-xl disabled:opacity-60">
          <Icon name="send" size="sm" /> {state === 'busy' ? 'در حال فرستادن…' : 'فرستادن'}
        </button>
        <p className="text-xs text-text-secondary">
          {mode === 'parent' ? 'با ایمیل حسابتان فرستاده می‌شود.' : 'ایمیلتان فقط برای جواب‌دادن به همین پیام است.'}
        </p>
      </div>
    </form>
  )
}
