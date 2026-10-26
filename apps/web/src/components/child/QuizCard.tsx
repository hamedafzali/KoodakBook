'use client'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import type { Word, Letter } from '@koodakbook/shared'
import { toPersianDigits, wordEmoji } from '@koodakbook/shared'
import Emoji from '@/components/shared/Emoji'
import { ClayButton, answerVars, softClayVars, type Ramp } from '@/components/child/clay'
import { thumbUrl } from '@/lib/media'
import { playTap, playSuccess } from '@/lib/sounds'
import { speakOrPlay } from '@/lib/speech'

export type QuizMode = 'flashcard' | 'listen_tap' | 'match_image' | 'name_it'

export interface QuizQuestion {
  mode: QuizMode
  correctWord?: Word
  correctLetter?: Letter
  distractorWords?: Word[]
  distractorLetters?: Letter[]
}

interface Props {
  question: QuizQuestion
  onCorrect: () => void
  onIncorrect: () => void
  onFlashcardNext: () => void
  /** The room this card sits in: the soft clay of its cards and options
   *  (mobile QuizCard's `ramp`). */
  ramp?: Ramp
}

function playErrorSound() {
  if (typeof window === 'undefined') return
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = 280
  osc.type = 'sine'
  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.25)
}

/** Visual for a word: real image if present, else mapped emoji, else null. */
function wordVisual(word: Word): { type: 'img' | 'emoji'; value: string } | null {
  const img = thumbUrl(word.image_url, 80)
  if (img) return { type: 'img', value: img }
  const e = wordEmoji(word.english)
  if (e) return { type: 'emoji', value: e }
  return null
}

export default function QuizCard({ question, onCorrect, onIncorrect, onFlashcardNext, ramp = 'brand' }: Props) {
  // Prompt cards are the clay container (white face, the room's soft edge)
  // instead of one-off white/gray cards; options are `.clay-option`.
  const card = softClayVars(ramp)
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  // One answer per card (it remounts per question): `feedback` is state, so
  // two clicks in one frame both saw null and both answered. And the 950ms
  // result callback is cleared on unmount, so it can't fire on a lesson the
  // child already left.
  const answeredRef = useRef(false)
  const answerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (answerTimer.current) clearTimeout(answerTimer.current) }, [])
  const { correctWord, correctLetter, distractorWords = [] } = question
  // A match_image card whose word has no picture asked «این چه کلمه‌ای است؟»
  // over a ❓ — unanswerable. It becomes listen_tap, whose prompt is the
  // word's sound (same fallback as mobile's QuizCard).
  const mode: QuizMode = question.mode === 'match_image' && correctWord && !wordVisual(correctWord)
    ? 'listen_tap'
    : question.mode
  // Shuffled ONCE per question. This used to run in each mode's render body,
  // so answering (setSelected/setFeedback re-render) reshuffled the grid: the
  // options jumped to new places the moment the result showed, and a
  // screen-reader user's «گزینه N» pointed at a different word. Same as
  // mobile's QuizCard.
  const options = useMemo(
    () => (correctWord ? shuffleOnce([correctWord, ...distractorWords.slice(0, 3)]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question],
  )

  // Auto-play the prompt the moment a card appears — the child listens
  // immediately; the speaker button stays for replay. Skip match_image, where
  // hearing the word would hand over the answer. Card remounts per question
  // (keyed), so this fires once each.
  useEffect(() => {
    if (mode === 'match_image') return
    const t = setTimeout(() => {
      if (correctWord) speakOrPlay(correctWord.audio_url, correctWord.persian)
      else if (correctLetter) speakOrPlay(correctLetter.audio_url, correctLetter.name_persian)
    }, 420)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAnswer = useCallback((id: string, isCorrect: boolean) => {
    if (answeredRef.current) return
    answeredRef.current = true
    setSelected(id)
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) {
      playSuccess()
      if (correctWord) speakOrPlay(correctWord.audio_url, correctWord.persian)
      answerTimer.current = setTimeout(onCorrect, 950)
    } else {
      playErrorSound()
      answerTimer.current = setTimeout(onIncorrect, 950)
    }
  }, [onCorrect, onIncorrect, correctWord])

  function speakPrompt() {
    playTap()
    if (correctWord) speakOrPlay(correctWord.audio_url, correctWord.persian)
    else if (correctLetter) speakOrPlay(correctLetter.audio_url, correctLetter.name_persian)
  }

  /* ── FLASHCARD ─────────────────────────────────────────────────────── */
  if (mode === 'flashcard') {
    if (correctWord) {
      const visual = wordVisual(correctWord)
      return (
        <motion.div className="flex flex-col items-center gap-4 w-full"
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}>
          <motion.button
            onClick={speakPrompt}
            className="w-full clay-static p-6 flex flex-col items-center gap-3 touch-target-child"
            style={card}
            whileTap={{ scale: 0.96 }}
            aria-label={`کلمه فارسی: ${correctWord.persian}. ضربه بزن تا بشنوی`}
          >
            {visual?.type === 'img' && <img src={visual.value} alt="" className="w-48 h-48 object-contain rounded-2xl" />}
            {visual?.type === 'emoji' && <span className="text-[7rem] leading-none" aria-hidden="true">{visual.value}</span>}
            <span className="text-5xl font-bold text-text-primary">{correctWord.persian}</span>
            <span className="text-base text-text-secondary ltr">{correctWord.english}</span>
            <span className="text-xs text-brand-text flex items-center gap-1"><Emoji name="speaker-high-volume" size={14} /> ضربه بزن تا بشنوی</span>
          </motion.button>
          <NextButton onClick={onFlashcardNext} />
        </motion.div>
      )
    }
    if (correctLetter) {
      return (
        <motion.div className="flex flex-col items-center gap-4 w-full"
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}>
          <motion.button
            onClick={() => { playTap(); speakOrPlay(correctLetter.audio_url, correctLetter.name_persian) }}
            className="w-full clay-static p-8 flex flex-col items-center gap-2 touch-target-child"
            style={card}
            whileTap={{ scale: 0.96 }}
            aria-label={`حرف فارسی: ${correctLetter.name_persian}. ضربه بزن تا بشنوی`}
          >
            <span className="text-7xl font-bold text-text-primary">{correctLetter.character}</span>
            <span className="text-xl text-text-secondary">{correctLetter.name_persian}</span>
            <span className="text-sm text-text-secondary ltr">{correctLetter.name_english}</span>
            <span className="text-xs text-brand-text flex items-center gap-1"><Emoji name="speaker-high-volume" size={14} /> ضربه بزن تا بشنوی</span>
          </motion.button>
          <NextButton onClick={onFlashcardNext} />
        </motion.div>
      )
    }
  }

  /* ── MATCH IMAGE — show picture, pick the Persian word ─────────────── */
  if (mode === 'match_image' && correctWord) {
    const visual = wordVisual(correctWord)
    return (
      <motion.div className="flex flex-col items-center gap-5 w-full"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="w-full clay-static p-4 flex items-center justify-center min-h-[180px]" style={card}>
          {visual?.type === 'img'
            ? <img src={visual.value} alt="این چیست؟" className="w-44 h-44 object-contain rounded-xl" />
            : <span className="text-[8rem] leading-none" aria-hidden="true">{visual?.value ?? '❓'}</span>}
        </div>
        <p className="font-bold text-text-primary text-lg persian-text">این چه کلمه‌ای است؟</p>
        <ResultAnnouncer feedback={feedback} answer={correctWord.persian} />
        <div className="grid grid-cols-2 gap-3 w-full">
          {options.map((word, i) => (
            <OptionButton
              key={word.id}
              index={i}
              label={word.persian}
              isCorrect={word.id === correctWord.id}
              isSelected={selected === word.id}
              feedback={feedback}
              onSelect={() => handleAnswer(word.id, word.id === correctWord.id)}
              ramp={ramp}
            />
          ))}
        </div>
      </motion.div>
    )
  }

  /* ── LISTEN & TAP — hear the word (TTS or recording), pick it ──────── */
  if (mode === 'listen_tap' && correctWord) {
    return (
      <motion.div className="flex flex-col items-center gap-5 w-full"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <motion.button
          onClick={speakPrompt}
          className="w-28 h-28 rounded-full bg-brand-gradient-br flex items-center justify-center shadow-lg touch-target-child"
          whileTap={{ scale: 0.88 }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          aria-label="پخش صدا — دوباره گوش کن"
        >
          <Emoji name="speaker-high-volume" size={56} />
        </motion.button>
        <p className="font-bold text-text-primary text-lg persian-text">کدام کلمه را شنیدی؟</p>
        <ResultAnnouncer feedback={feedback} answer={correctWord.persian} />
        <div className="grid grid-cols-2 gap-3 w-full">
          {options.map((word, i) => {
            const v = wordVisual(word)
            return (
              <OptionButton
                key={word.id}
                index={i}
                label={word.persian}
                emoji={v?.type === 'emoji' ? v.value : undefined}
                imageUrl={v?.type === 'img' ? v.value : undefined}
                isCorrect={word.id === correctWord.id}
                isSelected={selected === word.id}
                feedback={feedback}
                onSelect={() => handleAnswer(word.id, word.id === correctWord.id)}
                ramp={ramp}
              />
            )
          })}
        </div>
      </motion.div>
    )
  }

  /* ── NAME IT — show Persian word, pick the matching picture ────────── */
  if (mode === 'name_it' && correctWord) {
    return (
      <motion.div className="flex flex-col items-center gap-5 w-full"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => { playTap(); speakOrPlay(correctWord.audio_url, correctWord.persian) }}
          className="clay-static px-8 py-5 text-center touch-target-child"
          style={card}
          aria-label={`کلمه: ${correctWord.persian}. ضربه بزن تا بشنوی`}
        >
          <span className="text-5xl font-bold text-text-primary">{correctWord.persian}</span>
          <span className="block text-xs text-brand-text mt-1" aria-hidden="true"><Emoji name="speaker-high-volume" size={14} /> بشنو</span>
        </button>
        <p className="font-bold text-text-primary text-lg persian-text">کدام تصویر درست است؟</p>
        <ResultAnnouncer feedback={feedback} answer={correctWord.persian} />
        <div className="grid grid-cols-2 gap-3 w-full">
          {options.map((word, i) => {
            const v = wordVisual(word)
            return (
              <OptionButton
                key={word.id}
                index={i}
                emoji={v?.type === 'emoji' ? v.value : undefined}
                imageUrl={v?.type === 'img' ? v.value : undefined}
                label={feedback !== null ? word.persian : ''}
                isCorrect={word.id === correctWord.id}
                isSelected={selected === word.id}
                feedback={feedback}
                onSelect={() => handleAnswer(word.id, word.id === correctWord.id)}
                ramp={ramp}
                bigVisual
              />
            )
          })}
        </div>
      </motion.div>
    )
  }

  return null
}

/** The shared clay primary (brand ramp) rather than a one-off gradient slab. */
function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <ClayButton ramp="brand" size="lg" onClick={onClick}>
      بعدی ←
    </ClayButton>
  )
}

function OptionButton({
  index, label, emoji, imageUrl, isCorrect, isSelected, feedback, onSelect, bigVisual = false, ramp,
}: {
  ramp: Ramp
  /** Position in the grid, for the neutral «گزینه N» name below. */
  index: number
  label?: string
  emoji?: string
  imageUrl?: string
  isCorrect: boolean
  isSelected: boolean
  feedback: 'correct' | 'incorrect' | null
  onSelect: () => void
  bigVisual?: boolean
}) {
  const revealResult = feedback !== null && isSelected
  const showCorrect = feedback !== null && isCorrect && !isSelected

  // A picture-only option has no text, and naming it by correctness gave the
  // answer away to screen readers before the child chose («گزینه درست» on the
  // right picture). Neutral number until answered, then the result -- the
  // same rule as mobile's QuizCard.
  const result = revealResult ? (isCorrect ? '، درست' : '، نادرست') : showCorrect ? '، جواب درست' : ''
  const ariaLabel = `${label || `گزینه ${toPersianDigits(index + 1)}`}${result}`

  // Neutral = the room's soft clay; answered = mobile's answerRamps (right
  // bright green, a wrong pick pale rose). Was gray-200/green-50/red-50.
  const state = revealResult ? (isCorrect ? 'right' : 'wrong') : showCorrect ? 'right' : null

  return (
    <motion.button
      onClick={onSelect}
      disabled={feedback !== null}
      className="clay-option min-h-[72px] p-3 flex flex-col items-center justify-center gap-1 touch-target-child"
      style={answerVars(state, ramp)}
      whileTap={feedback === null ? { scale: 0.93 } : {}}
      animate={revealResult && !isCorrect ? { x: [-5, 5, -4, 4, 0] } : {}}
      transition={{ duration: 0.3 }}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
    >
      {imageUrl && <img src={imageUrl} alt="" aria-hidden="true" className={bigVisual ? 'w-20 h-20 object-contain' : 'w-14 h-14 object-contain rounded-lg'} />}
      {!imageUrl && emoji && <span aria-hidden="true" className={bigVisual ? 'text-6xl leading-none' : 'text-4xl leading-none'}>{emoji}</span>}
      {label && <span className="font-bold text-xl">{label}</span>}
      {revealResult && <Emoji name={isCorrect ? 'check-mark-button' : 'cross-mark'} size={18} className="mt-0.5" />}
      {showCorrect && <Emoji name="check-mark-button" size={18} className="mt-0.5" />}
    </motion.button>
  )
}

/** Screen-reader half of the answer feedback. The options go `disabled` the
 *  moment one is picked, so focus drops and the result suffix on the picked
 *  button's name is never read. This region is mounted empty with the card
 *  and only filled AFTER the answer — so it can never reveal the answer
 *  early (same rule as OptionButton's neutral «گزینه N» names). Wording is
 *  StoryQuiz's own feedback lines. */
function ResultAnnouncer({ feedback, answer }: { feedback: 'correct' | 'incorrect' | null; answer: string }) {
  return (
    <p className="sr-only" role="status">
      {feedback === 'correct' ? 'آفرین، درست بود!' : feedback === 'incorrect' ? `جواب درست: «${answer}»` : ''}
    </p>
  )
}

function shuffleOnce<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
