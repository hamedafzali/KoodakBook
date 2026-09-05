'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

const input = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

/** Tablet pre-order form — max 5 visible fields (short forms convert best). */
export function TabletForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', quantity: 1, message: '', website: '' })
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setState('busy')
    const r = await api.post('/api/leads', { type: 'tablet', ...form, quantity: Number(form.quantity) || 1 })
    if (r.error) { setErr(r.error); setState('idle'); return }
    setState('done')
  }

  if (state === 'done') return (
    <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
      <p className="text-3xl mb-2">🎉</p>
      <p className="font-bold text-green-800">درخواست شما ثبت شد!</p>
      <p className="text-sm text-green-700 mt-1">به‌زودی با شما تماس می‌گیریم تا جزئیات تبلت و ارسال را هماهنگ کنیم.</p>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="پیش‌سفارش تبلت">
      {/* honeypot — invisible to humans, bots fill it */}
      <input type="text" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
        className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="grid sm:grid-cols-2 gap-3">
        <input required placeholder="نام و نام خانوادگی" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={input} />
        <input required type="email" placeholder="ایمیل" dir="ltr" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={input} />
        <input placeholder="تلفن (اختیاری)" dir="ltr" value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={input} />
        <input placeholder="کشور محل سکونت" value={form.country}
          onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={input} />
      </div>
      <textarea rows={2} placeholder="توضیح (اختیاری) — مثلاً برای چند کودک و چه سنی؟" value={form.message}
        onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={input} />
      <button type="submit" disabled={state === 'busy'}
        className="w-full sm:w-auto bg-amber-700 hover:bg-amber-800 text-white font-bold px-8 py-3 rounded-xl transition disabled:opacity-60">
        {state === 'busy' ? 'در حال ارسال…' : 'ثبت پیش‌سفارش تبلت'}
      </button>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <p className="text-xs text-slate-500">با ثبت درخواست هیچ مبلغی پرداخت نمی‌کنید — اول با شما تماس می‌گیریم.</p>
    </form>
  )
}

/** One-field waitlist for the future Android/iOS apps. */
export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setState('busy')
    const r = await api.post('/api/leads', { type: 'app_waitlist', email, website })
    if (r.error) { setErr(r.error); setState('idle'); return }
    setState('done')
  }

  if (state === 'done') return (
    <p className="text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
      ✅ ثبت شد — به‌محض انتشار نرم‌افزار خبرتان می‌کنیم.
    </p>
  )

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2" aria-label="خبرم کن">
      <input type="text" value={website} onChange={e => setWebsite(e.target.value)}
        className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <input required type="email" placeholder="ایمیل شما" dir="ltr" value={email}
        onChange={e => setEmail(e.target.value)} className={`${input} sm:max-w-xs`} />
      <button type="submit" disabled={state === 'busy'}
        className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-3 rounded-xl transition disabled:opacity-60 whitespace-nowrap">
        {state === 'busy' ? '…' : 'خبرم کن'}
      </button>
      {err && <p className="text-sm text-red-600 self-center">{err}</p>}
    </form>
  )
}
