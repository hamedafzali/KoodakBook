'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Mascot from '@/components/child/Mascot'
import { ClayButton } from '@/components/child/clay'
import { playTap, playSuccess } from '@/lib/sounds'
import type { StoryQuestion } from '@koodakbook/shared'

/* ── Story comprehension quiz ────────────────────────────────────────────────
 *
 * Shown right after the last page, before the read-aloud prompt / badge —
 * see the same rule ReadAloud.tsx states for itself, applied here too:
 *
 *  1. Skippable, always, in one press — a "did you understand?" check that
 *     can't be escaped turns finishing a story into a test.
 *  2. Nothing here is scored or shown as a score. A wrong answer gets the
 *     same warm, encouraging feedback as a right one, just with the actual
 *     answer folded in gently — this is recall practice, not a quiz grade.
 *  3. Auto-advances after a short pause on every answer (right or wrong), so
 *     picking an answer always moves forward — never a dead end waiting for
 *     a "next" tap the child has to find.
 */

const ADVANCE_DELAY_MS = 1600

export default function StoryQuiz({
  questions, onDone,
}: {
  questions: StoryQuestion[]
  /** Called once, after the last question is answered or the whole thing is skipped. */
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const q = questions[index]
  const isLast = index === questions.length - 1
  const correct = picked !== null && picked === q.correct_index

  function choose(i: number) {
    if (picked !== null) return   // ignore extra taps while feedback is showing
    setPicked(i)
    if (i === q.correct_index) playSuccess(); else playTap()
    setTimeout(() => {
      if (isLast) { onDone(); return }
      setIndex(index + 1)
      setPicked(null)
    }, ADVANCE_DELAY_MS)
  }

  if (!q) { onDone(); return null }

  return (
    <div className="min-h-screen child-bg flex flex-col items-center justify-center gap-6 p-6 text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          className="flex flex-col items-center gap-5 w-full max-w-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          <Mascot size={104} mood={picked === null ? 'thinking' : correct ? 'proud' : 'encouraging'} />

          {index === 0 && picked === null && (
            <p className="text-sm text-text-secondary persian-text">بیا ببینیم چقدر یادته!</p>
          )}

          <h1 className="text-xl font-bold text-text-primary persian-text leading-relaxed">
            {q.question_persian}
          </h1>

          <div className="flex flex-col gap-3 w-full">
            {q.choices.map((choice, i) => (
              <ClayButton
                key={i}
                ramp="review"
                size="lg"
                disabled={picked !== null}
                onClick={() => choose(i)}
                icon={picked !== null && i === q.correct_index ? 'done' : undefined}
                className={picked !== null && i === picked && i !== q.correct_index ? 'opacity-60' : ''}
              >
                {choice}
              </ClayButton>
            ))}
          </div>

          {picked !== null && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-sm font-bold persian-text"
              style={{ color: correct ? 'var(--ramp-review-ink)' : 'var(--color-text-secondary)' }}
            >
              {correct ? 'آفرین، درست بود! 🎉' : `جواب درست: «${q.choices[q.correct_index]}»`}
            </motion.p>
          )}

          {picked === null && (
            <button onClick={onDone} className="min-h-[56px] px-5 text-text-secondary font-bold persian-text">
              رد شدن
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
