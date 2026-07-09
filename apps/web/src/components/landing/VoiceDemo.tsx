'use client'
import { useEffect, useRef, useState } from 'react'

/* Voice-quality comparison for the pricing section: the same story excerpt
 * read by the free voice and the premium voice. People buy what they can
 * hear. The clips are pre-generated in admin (صداها → ساخت نمونه) to fixed
 * paths; the whole widget hides itself until both files exist. */

const FREE_URL = '/uploads/demo/voice-free.wav'
const PREMIUM_URL = '/uploads/demo/voice-premium.wav'

const DEMO_TEXT =
  'یکی بود، یکی نبود. پیرزن مهربانی بود که دلش برای دخترش تنگ شده بود. ' +
  'گفت: می‌روم به دیدنش! راه خانه‌ی دختر از جنگل می‌گذشت و یک ماجرای شیرین در راه بود…'

export default function VoiceDemo() {
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState<'free' | 'premium' | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Show only when the admin has actually generated both samples.
    Promise.all([
      fetch(FREE_URL, { method: 'HEAD' }),
      fetch(PREMIUM_URL, { method: 'HEAD' }),
    ]).then(([a, b]) => setReady(a.ok && b.ok)).catch(() => setReady(false))
    return () => { audioRef.current?.pause() }
  }, [])

  if (!ready) return null

  function play(kind: 'free' | 'premium') {
    audioRef.current?.pause()
    if (playing === kind) { setPlaying(null); return }
    const audio = new Audio(kind === 'free' ? FREE_URL : PREMIUM_URL)
    audioRef.current = audio
    audio.onended = () => setPlaying(null)
    audio.play().then(() => setPlaying(kind)).catch(() => setPlaying(null))
  }

  return (
    <div className="mt-10 rounded-3xl bg-white border border-slate-200 p-6 sm:p-8">
      <div className="text-center mb-5">
        <p className="text-amber-600 font-bold text-sm mb-1.5">با گوش خودتان مقایسه کنید 🎧</p>
        <h3 className="text-xl font-bold text-slate-800">قصه‌گوی رایگان یا قصه‌گوی پرمیوم؟</h3>
      </div>

      <p className="persian-text text-slate-600 leading-loose text-center bg-amber-50/60 rounded-2xl px-5 py-4 mb-5">
        «{DEMO_TEXT}»
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={() => play('free')}
          className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold border-2 transition ${
            playing === 'free'
              ? 'border-slate-400 bg-slate-100 text-slate-700'
              : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>
          <span aria-hidden="true">{playing === 'free' ? '⏸' : '🔊'}</span>
          صدای رایگان
        </button>
        <button onClick={() => play('premium')}
          className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold border-2 transition ${
            playing === 'premium'
              ? 'border-amber-500 bg-amber-50 text-amber-700'
              : 'border-amber-300 text-amber-700 hover:border-amber-500 shadow-sm shadow-amber-100'}`}>
          <span aria-hidden="true">{playing === 'premium' ? '⏸' : '⭐'}</span>
          صدای پرمیوم
        </button>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4 persian-text">
        همه‌ی داستان‌ها، حروف و واژه‌ها در اشتراک پرمیوم با همین صدای طبیعی خوانده می‌شوند.
      </p>
    </div>
  )
}
