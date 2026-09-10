'use client'
import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@/components/icons'
import Mascot from '@/components/child/Mascot'
import { ClayButton } from '@/components/child/clay'
import { useRecorder, uploadRecording, faDuration, MAX_MS } from '@/lib/readAloud'

/* ── «حالا برای من بخوان» ────────────────────────────────────────────────────
 *
 * The screen the whole product is supposed to exist for, and it appears at the
 * one moment the emotional charge is already there: the child has just finished
 * a story. Not in a share menu, not on a settings page — here.
 *
 * Four rules this component follows:
 *
 *  1. It is skippable, always, in one press. A prompt a child can't get out of
 *     turns the end of a story into a chore.
 *  2. The child hears themselves before anything is sent. That playback IS the
 *     reward for a pre-reader — hearing your own voice read a book is the
 *     moment, and it doesn't depend on a grandparent existing yet.
 *  3. Recording shows sound. A level ring, not a spinner: a five-year-old
 *     cannot tell "listening" from "broken", so the ring moves with their voice.
 *  4. Nothing here is a competition. No score, no stars, no "great job!" —
 *     the under-gamified constraint applies hardest at the emotional peak.
 */

type Phase = 'offer' | 'record' | 'review' | 'sent'

export default function ReadAloud({
  childId, storyId, onDone,
}: {
  childId: string
  storyId?: string | null
  /** Called for every exit — sent, skipped, or failed. The caller decides
   *  where the child goes next; this component never navigates. */
  onDone: () => void
}) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { state, elapsedMs, level, recording, start, stop, reset } = useRecorder()

  /* Derived, not mirrored. The recorder already owns this — it stops itself at
   * MAX_MS, and falls back to 'denied' when the mic produces nothing — so a
   * second copy of the same state in an effect could only ever disagree with
   * it. `sent` is the one thing the recorder doesn't know about. */
  const phase: Phase =
    sent ? 'sent'
    : state === 'done' ? 'review'
    : state === 'asking' || state === 'recording' ? 'record'
    : 'offer'

  async function send() {
    if (!recording) return
    setSending(true)
    setError(null)
    const res = await uploadRecording(recording, childId, storyId)
    setSending(false)
    if (!res.ok) { setError(res.error); return }
    setSent(true)
    setTimeout(onDone, 2200)
  }

  const micBlocked = state === 'denied' || state === 'unsupported'

  return (
    <div className="min-h-screen child-bg flex flex-col items-center justify-center gap-6 p-6 text-center">
      <AnimatePresence mode="wait">

        {phase === 'offer' && (
          <motion.div key="offer" className="flex flex-col items-center gap-5"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Mascot size={120} mood="happy" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">حالا تو بخوان!</h1>
              <p className="text-slate-600 persian-text mt-1.5">
                داستان را با صدای خودت بخوان تا بعداً گوشش بدهیم
              </p>
            </div>

            {micBlocked && (
              /* Stated plainly and without blame, because the child did nothing
               * wrong and can't fix it — the parent has to. */
              <p className="text-sm text-slate-600 persian-text max-w-xs">
                {state === 'unsupported'
                  ? 'این دستگاه نمی‌تواند صدا ضبط کند.'
                  : 'برای ضبط صدا، باید به برنامه اجازه‌ی میکروفون بدهی.'}
              </p>
            )}

            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              {!micBlocked && (
                <ClayButton ramp="speak" size="lg" icon="record" onClick={start}>
                  شروع کن
                </ClayButton>
              )}
              <button onClick={onDone}
                className="min-h-[48px] px-5 text-slate-600 font-bold persian-text">
                الان نه
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'record' && (
          <motion.div key="record" className="flex flex-col items-center gap-6"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <p className="text-xl font-bold text-slate-800 persian-text">دارم گوش می‌دهم…</p>
            <LevelRing level={level} active={state === 'recording'} />
            <p className="text-3xl font-bold text-slate-700 tabular-nums" aria-live="off">
              {faDuration(elapsedMs)}
            </p>
            {/* Visible before it matters, so hitting the ceiling is never a
                surprise that eats a recording. */}
            <p className="text-xs text-slate-600 persian-text">
              تا {faDuration(MAX_MS)} می‌توانی بخوانی
            </p>
            <ClayButton ramp="rewards" size="lg" icon="done" onClick={stop}>
              تمام شد
            </ClayButton>
          </motion.div>
        )}

        {phase === 'review' && recording && (
          <motion.div key="review" className="flex flex-col items-center gap-5 w-full max-w-xs"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Mascot size={104} mood="happy" />
            <h1 className="text-2xl font-bold text-slate-800">به صدای خودت گوش بده</h1>
            <SelfPlayback url={recording.url} durationMs={recording.durationMs} />

            {error && <p className="text-sm text-rose-700 persian-text">{error}</p>}

            <div className="flex flex-col gap-3 w-full">
              <ClayButton ramp="speak" size="lg" icon="send" onClick={send} disabled={sending}>
                {sending ? 'در حال ذخیره…' : 'نگهش دار'}
              </ClayButton>
              <ClayButton ramp="review" size="md" icon="retry"
                onClick={() => { reset(); setError(null); start() }}>
                دوباره بخوان
              </ClayButton>
              <button onClick={onDone}
                className="min-h-[48px] text-slate-600 font-bold persian-text">
                بی‌خیال
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'sent' && (
          <motion.div key="sent" className="flex flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
              <Mascot size={120} mood="excited" />
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-800">ذخیره شد!</h1>
            <p className="text-slate-600 persian-text">مامان و بابا می‌توانند گوش بدهند</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

/* The proof that the microphone is working, in a form a pre-reader can read:
 * the ring grows with their voice. Height, not opacity — a child tracks size
 * long before they track contrast. */
function LevelRing({ level, active }: { level: number; active: boolean }) {
  return (
    <div className="relative w-[132px] h-[132px] grid place-items-center" aria-hidden="true">
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: 'var(--ramp-speak-soft)' }}
        animate={{ scale: active ? 1 + level * 0.34 : 1, opacity: active ? 0.55 + level * 0.35 : 0.4 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      />
      <div className="relative w-[92px] h-[92px] rounded-full grid place-items-center text-white"
        style={{ background: 'var(--ramp-speak-bright)' }}>
        <Icon name="record" size="xl" />
      </div>
    </div>
  )
}

/** Plain play/pause over the local blob. Nothing is uploaded to hear this. */
function SelfPlayback({ url, durationMs }: { url: string; durationMs: number }) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  return (
    <div className="w-full bg-white rounded-2xl shadow-card p-3 flex items-center gap-3">
      <audio ref={ref} src={url} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
      <button
        aria-label={playing ? 'توقف' : 'پخش صدای من'}
        onClick={() => {
          const el = ref.current
          if (!el) return
          if (playing) { el.pause() } else { el.play().then(() => setPlaying(true)).catch(() => {}) }
        }}
        className="w-14 h-14 rounded-full grid place-items-center text-white shrink-0"
        style={{ background: 'var(--ramp-speak-bright)' }}
      >
        <Icon name={playing ? 'pause' : 'play'} size="lg" />
      </button>
      <div className="text-right flex-1">
        <p className="font-bold text-slate-800 persian-text">صدای من</p>
        <p className="text-sm text-slate-500 tabular-nums">{faDuration(durationMs)}</p>
      </div>
    </div>
  )
}
