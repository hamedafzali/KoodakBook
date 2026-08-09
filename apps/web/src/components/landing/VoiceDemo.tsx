'use client'
import { useEffect, useRef, useState } from 'react'

/* Voice sample for the pricing section: a story excerpt read in the single
 * storyteller voice every account hears — audio quality is not a paid tier.
 * The clip is pre-generated in admin (صداها → ساخت نمونه) to a fixed path;
 * the widget hides itself until the file exists. */

const DEMO_URL = '/uploads/demo/voice.wav'

const DEMO_TEXT =
  'یکی بود، یکی نبود. پیرزن مهربانی بود که دلش برای دخترش تنگ شده بود. ' +
  'گفت: می‌روم به دیدنش! راه خانه‌ی دختر از جنگل می‌گذشت و یک ماجرای شیرین در راه بود…'

export default function VoiceDemo() {
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Show only when the admin has actually generated the sample.
    fetch(DEMO_URL, { method: 'HEAD' }).then(r => setReady(r.ok)).catch(() => setReady(false))
    return () => { audioRef.current?.pause() }
  }, [])

  if (!ready) return null

  function toggle() {
    audioRef.current?.pause()
    if (playing) { setPlaying(false); return }
    const audio = new Audio(DEMO_URL)
    audioRef.current = audio
    audio.onended = () => setPlaying(false)
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  return (
    <div className="mt-10 rounded-3xl bg-white border border-slate-200 p-6 sm:p-8">
      <div className="text-center mb-5">
        <p className="text-amber-600 font-bold text-sm mb-1.5">با گوش خودتان بشنوید 🎧</p>
        <h3 className="text-xl font-bold text-slate-800">صدای قصه‌گوی کوداک‌بوک</h3>
      </div>

      <p className="persian-text text-slate-600 leading-loose text-center bg-amber-50/60 rounded-2xl px-5 py-4 mb-5">
        «{DEMO_TEXT}»
      </p>

      <div className="flex justify-center">
        <button onClick={toggle}
          className={`flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold border-2 transition ${
            playing
              ? 'border-amber-500 bg-amber-50 text-amber-700'
              : 'border-amber-300 text-amber-700 hover:border-amber-500 shadow-sm shadow-amber-100'}`}>
          <span aria-hidden="true">{playing ? '⏸' : '🔊'}</span>
          {playing ? 'در حال پخش…' : 'شنیدن نمونه'}
        </button>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4 persian-text">
        همه‌ی داستان‌ها، حروف و واژه‌ها با همین صدای طبیعی خوانده می‌شوند — برای همه‌ی حساب‌ها.
      </p>
    </div>
  )
}
