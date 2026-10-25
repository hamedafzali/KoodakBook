'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { enterChildMode } from '@/lib/mode'
import Mascot from '@/components/child/Mascot'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import LoadingScreen from '@/components/child/LoadingScreen'
import ErrorState from '@/components/child/ErrorState'
import { ClayButton, clayVars, softClayVars } from '@/components/child/clay'
import { speakOrPlay, speakPersian, stopSpeaking, initSpeech } from '@/lib/speech'
import { useSpeaking } from '@/lib/useSpeaking'
import { playTap, playSuccess } from '@/lib/sounds'
import { wordEmoji, currentProbeStep, recordProbeAnswer, emptyProbeResults, toPersianDigits } from '@koodakbook/shared'
import type { Child, PlacementProbe, ProbeChoice, ProbeResults, ProbeStep } from '@koodakbook/shared'
import { Icon } from '@/components/icons'

type Phase = 'loading' | 'intro' | 'question' | 'feedback' | 'done'

function choiceFace(c: ProbeChoice): string {
  if (c.kind === 'letter') return c.character ?? c.persian
  return wordEmoji(c.english) ?? c.persian
}

export default function PlacementPage() {
  return (
    <Suspense fallback={<LoadingScreen message="آماده‌سازی بازی..." />}>
      <PlacementInner />
    </Suspense>
  )
}

// `?mode=reprobe` runs this as periodic re-placement instead of onboarding
// (docs/re-placement-flow-design.md §2) — see the mobile client's equivalent
// (apps/mobile/app/placement.tsx) for the full rationale; kept in sync here
// so the two clients can't drift on the parts that must stay identical.
//
// Placement probe rebuild (docs/placement-probe-rebuild.md): the fixed
// 4-question array is gone. The server hands back an item BANK (a mid item
// per strand plus its hard/easy branch candidates); `@koodakbook/shared`'s
// probeFlow walks that bank strand-by-strand as answers come in, so this file
// never decides the branch rule itself — mobile shares the exact same logic.
// Onboarding and reprobe now progress identically (§6): the pre-rebuild
// "abort the whole probe at the first miss" behaviour is gone — a branch to
// an easier item is still forward motion, never a stop, for either flow.
function PlacementInner() {
  const router = useRouter()
  // The reveal's 2.6s hop home: cleared if the child leaves first.
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current) }, [])
  const searchParams = useSearchParams()
  const isReprobe = searchParams.get('mode') === 'reprobe'
  const [child, setChild] = useState<Child | null>(null)
  const [bank, setBank] = useState<PlacementProbe | null>(null)
  const [results, setResults] = useState<ProbeResults>(emptyProbeResults())
  const [phase, setPhase] = useState<Phase>('loading')
  const [lastCorrect, setLastCorrect] = useState(false)
  const [finalLevel, setFinalLevel] = useState(1)
  // A ref because finish() needs the LATEST results synchronously, before the
  // setResults state update from the final answer has necessarily flushed.
  const resultsRef = useRef<ProbeResults>(emptyProbeResults())
  // A failed load or result save stops on ErrorState with a retry (mirrors
  // mobile's placement.tsx). Before: a failed /api/children read as "no
  // children" and sent the parent to /onboarding to create a duplicate; a
  // failed probe fetch went home without placing the child, and home sent
  // the child straight back here (a loop); a failed save was ignored.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // Whether the save being retried should show the reveal afterwards.
  const revealRef = useRef(true)
  const retryLoad = () => { setLoadError(null); setPhase('loading'); setReloadKey(k => k + 1) }
  /** Saves the result; `reveal` false skips the level reveal (no questions
   *  were asked). `target` is for the load path, before `child` state lands. */
  async function finish(reveal = true, target: Child | null = child) {
    revealRef.current = reveal
    if (target) {
      if (isReprobe) {
        const res = await api.post(`/api/placement/${target.id}/reprobe-result`, resultsRef.current)
        if (res.error) { setSaveError(res.error); return }
      } else {
        // Scoring (§5) now lives server-side — it needs gate.ts's w(n) for
        // confidence — so the level for the reveal screen comes back on the
        // response instead of being computed here before the request.
        const res = await api.post<Child>('/api/placement/result', { child_id: target.id, results: resultsRef.current })
        if (!res.data) { setSaveError(res.error || 'اتصال برقرار نشد. دوباره تلاش کن'); return }
        setFinalLevel(res.data.level)
      }
    }
    enterChildMode()
    if (!reveal) { router.push('/child/home'); return }
    setPhase('done')
    doneTimer.current = setTimeout(() => router.push('/child/home'), 2600)
  }

  const retrySave = () => { setSaveError(null); setPhase('loading'); void finish(revealRef.current) }

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    let cancelled = false
    async function load() {
      const [childRes, probeRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<PlacementProbe>('/api/placement/probe'),
      ])
      if (cancelled) return
      // Too little content for a probe: an empty bank, or the backend's 503
      // «Not enough content…» (routes/placement.ts). Not an error a retry
      // could fix: home sends every unplaced child back here, so treating it
      // as one locked the child out. Same rule as mobile placement.tsx.
      const noContent = probeRes.data
        ? !currentProbeStep(probeRes.data, emptyProbeResults())
        : probeRes.status === 503 || probeRes.error === 'Not enough content to build a placement probe'
      if (!childRes.data || (!probeRes.data && !noContent)) {
        const msg = childRes.error || probeRes.error
        // The backend's English messages stay off the child's screen.
        setLoadError(msg && /[\u0600-\u06FF]/.test(msg) ? msg : 'اتصال برقرار نشد. دوباره تلاش کن')
        return
      }
      // Only a list that really is empty means "add a child first".
      const c = pickChild(childRes.data)
      if (!c) { router.push('/onboarding'); return }
      setChild(c)
      if (noContent || !probeRes.data) {
        // No usable probe content. Onboarding records the empty result: the
        // backend scores every skipped strand as level 1 with zero confidence
        // (lib/probe.ts scoreBranchStrand([]) / scoreSingleStrand(null)) and
        // sets placement_done, so home doesn't send the child back here. A
        // re-probe has nothing to refresh and simply goes home.
        if (isReprobe) { enterChildMode(); router.push('/child/home'); return }
        void finish(false, c)
        return
      }
      setBank(probeRes.data)
      // Simorgh hosts: greet first, and the «بزن بریم» tap doubles as the user
      // gesture browsers require before the first listen-question can auto-play.
      setPhase('intro')
    }
    load()
    return () => { cancelled = true }
    // finish is a plain function of this render; the load only re-runs on retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, reloadKey, isReprobe])

  const step: ProbeStep | null = bank ? currentProbeStep(bank, results) : null
  const q = step?.question
  const speaking = useSpeaking()   // syncs Simorgh's talking mouth to her voice

  // Simorgh speaks her welcome when the intro appears.
  useEffect(() => {
    if (phase !== 'intro' || !child) return
    initSpeech()
    const t = setTimeout(() => speakPersian(`سلام ${child.name}! من سیمرغم! بیا با هم یک بازی کوچولو کنیم!`), 400)
    return () => clearTimeout(t)
  }, [phase, child])

  // Auto-play the audio prompt when a listen-question appears.
  useEffect(() => {
    if (phase !== 'question' || !q || q.mode !== 'listen') return
    initSpeech()
    const correct = q.choices.find(c => c.id === q.correct_id)
    const t = setTimeout(() => speakOrPlay(q.audio_url, correct?.persian ?? ''), 350)
    return () => clearTimeout(t)
  }, [phase, q])

  function answer(choice: ProbeChoice) {
    if (phase !== 'question' || !step) return
    const ok = choice.id === step.question.correct_id
    setLastCorrect(ok)
    if (ok) playSuccess(); else playTap()
    setPhase('feedback')

    setTimeout(() => {
      const updated = recordProbeAnswer(resultsRef.current, step, ok)
      resultsRef.current = updated
      setResults(updated)
      if (bank && currentProbeStep(bank, updated)) {
        setPhase('question')
      } else {
        finish()
      }
    }, 1100)
  }

  if (loadError || saveError) {
    return (
      <ErrorState
        title={saveError ? 'نتیجه ذخیره نشد' : 'نتونستیم بازی رو بیاریم'}
        message={loadError ?? saveError}
        onRetry={saveError ? retrySave : retryLoad}
        backHref={isReprobe ? '/child/home' : null}
      />
    )
  }

  if (phase === 'loading') return <LoadingScreen message="آماده‌سازی بازی..." />

  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 text-center">
        <CharacterAvatar slug="simorgh" size={150} mood="happy" talking={speaking} />
        <h1 className="font-display font-black text-2xl text-text-primary mt-5 persian-text">سلام {child?.name}! من سیمرغم</h1>
        <p className="text-text-secondary mt-2 persian-text leading-relaxed max-w-xs">
          بیا با هم یک بازی کوچولو کنیم تا ببینم چی بلدی — امتحان نیست، فقط بازیه!
        </p>
        {/* Clay, like every child action (was white on amber-500, ~2.1:1). */}
        <div className="mt-8 w-full max-w-xs">
          <ClayButton size="lg" onClick={() => { playTap(); stopSpeaking(); setPhase('question') }}>
            بزن بریم!
          </ClayButton>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const labels = ['', 'تازه‌کار', 'آشنا با کلمه‌ها', 'خواننده‌ی کوچک', 'خواننده‌ی ماهر']
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <Mascot size={120} mood="excited" />
        </motion.div>
        <h1 className="font-display font-black text-2xl text-text-primary mt-4">آفرین {child?.name}!</h1>
        {/* Re-placement never reveals a level — a recurring scorecard is
            exactly the signal the gate/trophy split exists to hide, and a
            re-placement result can legitimately move the gate down (§2/§3). */}
        <p className="text-text-secondary mt-2 persian-text">
          {isReprobe ? 'خیلی خوب بود!' : <>از اینجا شروع می‌کنیم: <b>{labels[finalLevel]}</b></>}
        </p>
        <p className="text-sm text-text-secondary mt-4 persian-text">در حال رفتن به خانه...</p>
      </div>
    )
  }

  if (!q) return <LoadingScreen message="..." />

  return (
    <div className="min-h-screen child-bg flex flex-col">
      {/* No difficulty tier, question number, or "X of N" counter — the
          child's staircase branch is never revealed (§6). Simorgh's own
          animation beats are enough progress feedback for this age group. */}
      <div className="flex justify-center pt-8">
        <CharacterAvatar slug="simorgh" size={64} mood={phase === 'feedback' ? (lastCorrect ? 'excited' : 'encouraging') : 'happy'} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6">
        <p className="text-lg font-bold text-text-primary text-center persian-text">{q.prompt}</p>

        {/* Prompt media */}
        {q.mode === 'listen' ? (
          <button
            onClick={() => { playTap(); const correct = q.choices.find(c => c.id === q.correct_id); speakOrPlay(q.audio_url, correct?.persian ?? '') }}
            className="clay w-28 h-28 flex items-center justify-center text-5xl touch-target-child"
            style={{ ...clayVars('stories'), '--clay-radius': '9999px' } as React.CSSProperties}
            aria-label="دوباره گوش کن"
          >
            <Icon name="listen" size="lg" />
          </button>
        ) : (
          <div className="clay-static px-6 py-6 sm:px-10 sm:py-8" style={{ '--clay-edge': 'var(--ramp-brand-bright)' } as React.CSSProperties}>
            <span className="text-4xl sm:text-6xl font-bold text-text-primary">{q.show_text}</span>
          </div>
        )}

        {/* Choices */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm" role="group" aria-label="گزینه‌ها">
          {q.choices.map((c, i) => (
            <motion.button
              key={c.id}
              onClick={() => answer(c)}
              disabled={phase !== 'question'}
              whileTap={{ scale: 0.92 }}
              className="clay-option aspect-square flex flex-col items-center justify-center gap-1 disabled:opacity-60 touch-target-child"
              style={softClayVars('brand')}
              // Neutral while answering: the choice's word IS the answer on a
              // listen item (and on a read item). Once answered, the choices
              // are named and the right one is marked, as a sighted child sees.
              aria-label={phase === 'question'
                ? `گزینه ${toPersianDigits(i + 1)}`
                : `${c.persian}${c.id === q.correct_id ? ' — جواب درست' : ''}`}
            >
              <span className={c.kind === 'letter' ? 'text-3xl sm:text-5xl font-bold text-text-primary' : 'text-3xl sm:text-5xl'}>{choiceFace(c)}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Feedback overlay */}
      <AnimatePresence>
        {phase === 'feedback' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-2">
              <Mascot size={100} mood={lastCorrect ? 'excited' : 'encouraging'} />
              <p className={`font-display font-black text-xl ${lastCorrect ? 'text-green-700' : 'text-amber-800'}`}>
                {lastCorrect ? 'آفرین!' : 'اشکالی نداره'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
