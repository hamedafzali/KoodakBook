'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { isLoggedIn } from '@/lib/auth'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import Mascot from '@/components/child/Mascot'
import { playTap, playSuccess, playComplete } from '@/lib/sounds'
import { speakOrPlay, speakOrPlayFirst, initSpeech } from '@/lib/speech'
import { audioCandidates } from '@/lib/premium'
import {
  SHORT_VOWELS, PHONICS_CONSONANTS, phonicsSyllables, phonicsAudioUrl,
  type Syllable,
} from '@koodakbook/shared'
import { Icon } from '@/components/icons'
import { SectionTitle, ClayButton } from '@/components/child/kit'
import { ClayBar, clayVars } from '@/components/child/clay'

const DEMO = 'ب' // base consonant used to demonstrate each vowel mark

/* Every colour on this screen is the `phonics` ramp. The three vowel marks used
 * to carry three unrelated gradients from SHORT_VOWELS.color, which said "three
 * different subjects" when they are three marks of one. What actually separates
 * them — the glyph — is already the largest thing on the tile, so the hue is
 * free to go back to meaning "this is phonics". */

function playErrorSound() {
  if (typeof window === 'undefined') return
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const osc = ctx.createOscillator(); const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.frequency.value = 280; osc.type = 'sine'
  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
  osc.start(); osc.stop(ctx.currentTime + 0.25)
}

function shuffle<T>(a: T[]): T[] { return [...a].sort(() => Math.random() - 0.5) }

/* canvas-confetti wants literal colours, so this reads the ramps at call time
 * rather than freezing three hexes that drift the moment the ramp is
 * regenerated. Falls back to the shipped values if a token is missing. */
function confettiColors(): string[] {
  const css = typeof window === 'undefined' ? null : getComputedStyle(document.documentElement)
  const pick = (name: string, fallback: string) =>
    css?.getPropertyValue(name).trim() || fallback
  return [
    pick('--ramp-phonics-bright', '#f97316'),
    pick('--ramp-rewards-bright', '#22c55e'),
    pick('--ramp-brand-bright', '#3b82f6'),
  ]
}

/* ── Merge stage: the blending animation IS the phonics lesson ──────────────
 * Consonant slides in, the vowel mark drops onto it, they "snap" into the
 * syllable exactly as its sound plays — seeing the merge while hearing it is
 * what blending means. Timings match the audio delay in demoMerge(). */
interface MergeDemo { c: string; mark: string; text: string; markName: string; run: number }

function MergeStage({ demo }: { demo: MergeDemo | null }) {
  const reduce = useReducedMotion()
  if (!demo) return (
    <div
      className="bg-white/80 border-2 border-dashed rounded-2xl h-28 flex items-center justify-center persian-text text-sm text-center px-4"
      style={{ borderColor: 'var(--ramp-phonics-soft)', color: 'var(--ramp-phonics-ink)' }}
    >
      روی یک هجا ضربه بزن تا ببینی چطور ساخته می‌شود
    </div>
  )
  if (reduce) return (
    <div className="bg-white rounded-2xl h-28 shadow-card flex items-center justify-center">
      <span className="text-6xl font-bold" style={{ color: 'var(--ramp-phonics-ink)' }}>{demo.text}</span>
    </div>
  )
  return (
    <div key={demo.run} className="bg-white rounded-2xl h-28 shadow-card relative overflow-hidden" aria-label={`ساخت هجای ${demo.text}`}>
      {/* the two parts fly together… */}
      <motion.span className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-text-primary"
        initial={{ x: 70, opacity: 0 }}
        animate={{ x: [70, 8, 8], opacity: [0, 1, 0] }}
        transition={{ duration: 0.75, times: [0, 0.6, 1], ease: 'easeOut' }}>
        {demo.c}
      </motion.span>
      {/* The vowel mark is the thing being added, so it is the one element
          allowed a different value: `bright` against the consonant's slate. */}
      <motion.span className="absolute inset-0 flex items-center justify-center text-5xl font-bold"
        style={{ color: 'var(--ramp-phonics-bright)' }}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: [-60, -14, -14], opacity: [0, 1, 0] }}
        transition={{ duration: 0.75, times: [0, 0.6, 1], ease: 'easeOut' }}>
        {'◌' + demo.mark}
      </motion.span>
      {/* …and snap into the syllable as the audio fires */}
      <motion.span className="absolute inset-0 flex items-center justify-center text-7xl font-bold"
        style={{ color: 'var(--ramp-phonics-ink)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.18, 1], opacity: [0, 0, 1, 1] }}
        transition={{ duration: 1.05, times: [0, 0.55, 0.8, 1], ease: 'easeOut' }}>
        {demo.text}
      </motion.span>
      <motion.span className="absolute left-4 top-3 text-xl" initial={{ scale: 0 }}
        animate={{ scale: [0, 0, 1.3, 0] }} transition={{ duration: 1.3, times: [0, 0.6, 0.8, 1] }}>
        <span style={{ color: 'var(--ramp-rewards-bright)' }}><Icon name="sparkle" size={40} /></span>
      </motion.span>
      <span className="absolute right-3 bottom-2 text-[11px] text-text-secondary persian-text">{demo.markName}</span>
    </div>
  )
}

export default function PhonicsPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'learn' | 'quiz' | 'done'>('learn')
  const all = useMemo(() => phonicsSyllables(), [])

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
  }, [router])

  const [demo, setDemo] = useState<MergeDemo | null>(null)
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function say(text: string, slug: string) {
    playTap()
    speakOrPlayFirst(audioCandidates(phonicsAudioUrl(slug)), text)
  }

  /** Learn-mode tap: run the merge animation and fire the audio at the snap. */
  function demoMerge(c: string, mark: string, markName: string, text: string, slug: string) {
    playTap()
    setDemo(d => ({ c, mark, markName, text, run: (d?.run ?? 0) + 1 }))
    if (demoTimer.current) clearTimeout(demoTimer.current)
    demoTimer.current = setTimeout(() => speakOrPlayFirst(audioCandidates(phonicsAudioUrl(slug)), text), 550)
  }

  if (phase === 'quiz') return <PhonicsQuiz all={all} say={say} onDone={() => setPhase('done')} onExit={() => setPhase('learn')} />

  if (phase === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
          <Mascot size={130} mood="excited" />
        </motion.div>
        <h1 className="text-3xl font-bold text-text-primary">آفرین!</h1>
        <p className="text-text-secondary persian-text">حالا می‌تونی حرف‌ها رو بخونی!</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <ClayButton ramp="phonics" size="lg" icon="retry" onClick={() => setPhase('quiz')}>
            یک بار دیگه
          </ClayButton>
          <motion.button onClick={() => router.push('/child/home')} whileTap={{ scale: 0.96 }}
            className="w-full py-3.5 rounded-2xl border-2 border-border text-text-primary font-bold min-h-[52px]">
            برگشت به خانه
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="صداها" subtitle="زبر، زیر، پیش" module="phonics" />

      <div className="px-4 pt-5 space-y-7">
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'var(--ramp-phonics-soft)', color: 'var(--ramp-phonics-ink)' }}
        >
          <Mascot size={64} mood="happy" />
          <p className="persian-text text-sm flex-1 font-medium">
            این سه نشانه به حرف‌ها صدا می‌دهند. ضربه بزن، ببین و گوش کن!
          </p>
        </div>

        {/* The blending stage — sticky so every tap below plays here in view */}
        <div className="sticky top-2 z-10">
          <MergeStage demo={demo} />
        </div>

        {/* The three marks */}
        <section>
          <SectionTitle module="phonics">حرکت‌ها</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {SHORT_VOWELS.map(v => {
              const syll = DEMO + v.mark
              return (
                <motion.button key={v.key} onClick={() => demoMerge(DEMO, v.mark, v.namePersian, syll, 'b' + v.latin)}
                  whileTap={{ y: 4 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  style={clayVars('phonics')}
                  className="clay p-4 text-white flex flex-col items-center gap-1 min-h-[110px] justify-center touch-target"
                  aria-label={`${v.namePersian}: ${syll}`}>
                  <span className="text-5xl font-bold leading-none drop-shadow-sm">{syll}</span>
                  <span className="text-sm font-medium mt-1">{v.namePersian}</span>
                  <span className="text-xs text-white/85 ltr">{v.latin}</span>
                </motion.button>
              )
            })}
          </div>
        </section>

        {/* Syllable grids per vowel */}
        {SHORT_VOWELS.map(v => (
          <section key={v.key}>
            <SectionTitle module="phonics">
              با {v.namePersian} <span className="text-text-secondary text-sm ltr font-medium">({v.latin})</span>
            </SectionTitle>
            <div className="grid grid-cols-4 gap-2">
              {PHONICS_CONSONANTS.map(c => {
                const text = c.ch + v.mark
                const slug = c.latin + v.latin
                return (
                  <motion.button key={slug} onClick={() => demoMerge(c.ch, v.mark, v.namePersian, text, slug)} whileTap={{ scale: 0.92 }}
                    className="bg-white rounded-2xl py-3 shadow-card flex flex-col items-center gap-0.5 touch-target"
                    aria-label={`بخوان: ${text}`}>
                    <span className="text-3xl font-bold text-text-primary">{text}</span>
                    <span className="text-[11px] text-text-secondary ltr">{slug}</span>
                  </motion.button>
                )
              })}
            </div>
          </section>
        ))}

        <ClayButton ramp="phonics" size="lg" icon="listen" onClick={() => setPhase('quiz')}>
          بریم تمرین
        </ClayButton>
      </div>

      <BottomNav />
    </div>
  )
}

/* ── Listen-and-pick practice ──────────────────────────────────────────── */
function PhonicsQuiz({ all, say, onDone, onExit }: {
  all: Syllable[]
  say: (text: string, slug: string) => void
  onDone: () => void
  onExit: () => void
}) {
  const ROUNDS = 6
  const questions = useMemo(() => {
    return shuffle(all).slice(0, ROUNDS).map(correct => {
      const distractors = shuffle(all.filter(s => s.slug !== correct.slug)).slice(0, 3)
      return { correct, options: shuffle([correct, ...distractors]) }
    })
  }, [all])

  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const firedRef = useRef(false)
  const q = questions[idx]

  // auto-play the target when the question appears
  useEffect(() => {
    if (q) { const t = setTimeout(() => say(q.correct.text, q.correct.slug), 350); return () => clearTimeout(t) }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  function choose(slug: string) {
    if (picked) return
    setPicked(slug)
    const ok = slug === q.correct.slug
    if (ok) { playSuccess(); setCorrectCount(c => c + 1) } else { playErrorSound() }
    setTimeout(() => {
      if (idx >= questions.length - 1) {
        if (!firedRef.current) {
          firedRef.current = true
          confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 }, colors: confettiColors() })
          playComplete()
        }
        onDone()
      } else { setPicked(null); setIdx(i => i + 1) }
    }, 900)
  }

  return (
    <div className="min-h-screen child-bg flex flex-col">
      <div className="bg-white/90 backdrop-blur-md border-b border-border px-5 py-3 flex items-center gap-3">
        <motion.button onClick={onExit} whileTap={{ scale: 0.85 }} aria-label="برگشت"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-subtle">
          <Icon name="back" size="md" strokeWidth={2.5} />
        </motion.button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="font-bold text-text-primary text-sm">گوش کن و انتخاب کن</h1>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--ramp-phonics-ink)' }}>
              {idx + 1}/{questions.length}
            </span>
          </div>
          <ClayBar ramp="phonics" value={(idx / questions.length) * 100} label="پیشرفت تمرین" />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-5 gap-8">
        <motion.button onClick={() => say(q.correct.text, q.correct.slug)} whileTap={{ scale: 0.9 }}
          animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          /* The material owns its radius — a `rounded-full` class would lose to
             the unlayered `.clay` rule, so the circle comes through the var. */
          style={{ ...clayVars('phonics'), '--clay-radius': '9999px' } as React.CSSProperties}
          className="clay w-28 h-28 flex items-center justify-center touch-target text-white"
          aria-label="دوباره گوش کن">
          <Icon name="listen" size="xl" />
        </motion.button>
        <p className="text-text-primary persian-text">کدام را شنیدی؟</p>

        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          <AnimatePresence>
            {q.options.map(opt => {
              const isCorrect = opt.slug === q.correct.slug
              const show = picked !== null
              /* Feedback greens and reds are semantic, not the module hue, so
               * they stay outside the ramps — but at the -700 steps, where the
               * text clears AA on its own tint (the -600/-400 pair it replaced
               * did not). The dimmed non-answers go to slate-500 (4.8:1), not
               * gray-400 (2.6:1) — a wrong answer still has to be readable. */
              const cls = show
                ? isCorrect ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                  : opt.slug === picked ? 'bg-rose-50 border-rose-400 text-rose-700' : 'bg-white border-border text-text-secondary'
                : 'bg-white border-border text-text-primary'
              return (
                <motion.button key={opt.slug} onClick={() => choose(opt.slug)} whileTap={{ scale: 0.95 }}
                  className={`rounded-2xl border-2 py-6 shadow-card font-bold text-4xl touch-target ${cls}`}
                  aria-label={`انتخاب ${opt.text}`}>
                  {opt.text}
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
