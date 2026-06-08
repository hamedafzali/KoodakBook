'use client'
import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Word, Letter } from '@koodakbook/shared'
import { wordEmoji } from '@koodakbook/shared'
import { mediaUrl } from '@/lib/media'
import { playTap, playSuccess } from '@/lib/sounds'
import { speakPersian, speakOrPlay } from '@/lib/speech'

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
  const img = mediaUrl(word.image_url)
  if (img) return { type: 'img', value: img }
  const e = wordEmoji(word.english)
  if (e) return { type: 'emoji', value: e }
  return null
}

export default function QuizCard({ question, onCorrect, onIncorrect, onFlashcardNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { mode, correctWord, correctLetter, distractorWords = [] } = question

  const handleAnswer = useCallback((id: string, isCorrect: boolean) => {
    if (feedback !== null) return
    setSelected(id)
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) {
      playSuccess()
      if (correctWord) speakOrPlay(correctWord.audio_url, correctWord.persian)
      setTimeout(onCorrect, 950)
    } else {
      playErrorSound()
      setTimeout(onIncorrect, 950)
    }
  }, [feedback, onCorrect, onIncorrect, correctWord])

  function speakPrompt() {
    playTap()
    if (correctWord?.audio_url && audioRef.current) audioRef.current.play().catch(() => correctWord && speakPersian(correctWord.persian))
    else if (correctWord) speakPersian(correctWord.persian)
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
            className="w-full bg-white rounded-[1.75rem] shadow-lg p-6 flex flex-col items-center gap-3 touch-target"
            whileTap={{ scale: 0.96 }}
            aria-label={`کلمه فارسی: ${correctWord.persian}. ضربه بزن تا بشنوی`}
          >
            {visual?.type === 'img' && <img src={visual.value} alt="" className="w-48 h-48 object-contain rounded-2xl" />}
            {visual?.type === 'emoji' && <span className="text-[7rem] leading-none" aria-hidden="true">{visual.value}</span>}
            <span className="text-5xl font-bold text-gray-800">{correctWord.persian}</span>
            <span className="text-base text-gray-400 ltr">{correctWord.english}</span>
            <span className="text-xs text-amber-500 flex items-center gap-1"><span>🔊</span> ضربه بزن تا بشنوی</span>
          </motion.button>
          {correctWord.audio_url && <audio ref={audioRef} src={mediaUrl(correctWord.audio_url)!} preload="none" />}
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
            className="w-full bg-white rounded-[1.75rem] shadow-lg p-8 flex flex-col items-center gap-2 touch-target"
            whileTap={{ scale: 0.96 }}
            aria-label={`حرف فارسی: ${correctLetter.name_persian}. ضربه بزن تا بشنوی`}
          >
            <span className="text-7xl font-bold text-gray-800">{correctLetter.character}</span>
            <span className="text-xl text-gray-600">{correctLetter.name_persian}</span>
            <span className="text-sm text-gray-400 ltr">{correctLetter.name_english}</span>
            <span className="text-xs text-amber-500 flex items-center gap-1"><span>🔊</span> ضربه بزن تا بشنوی</span>
          </motion.button>
          <NextButton onClick={onFlashcardNext} />
        </motion.div>
      )
    }
  }

  /* ── MATCH IMAGE — show picture, pick the Persian word ─────────────── */
  if (mode === 'match_image' && correctWord) {
    const options = shuffleOnce([correctWord, ...distractorWords.slice(0, 3)])
    const visual = wordVisual(correctWord)
    return (
      <motion.div className="flex flex-col items-center gap-5 w-full"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="w-full bg-white rounded-[1.75rem] shadow-md p-4 flex items-center justify-center min-h-[180px]">
          {visual?.type === 'img'
            ? <img src={visual.value} alt="این چیست؟" className="w-44 h-44 object-contain rounded-xl" />
            : <span className="text-[8rem] leading-none" aria-hidden="true">{visual?.value ?? '❓'}</span>}
        </div>
        <p className="font-bold text-gray-700 text-lg persian-text">این چه کلمه‌ای است؟</p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {options.map(word => (
            <OptionButton
              key={word.id}
              label={word.persian}
              isCorrect={word.id === correctWord.id}
              isSelected={selected === word.id}
              feedback={feedback}
              onSelect={() => handleAnswer(word.id, word.id === correctWord.id)}
            />
          ))}
        </div>
      </motion.div>
    )
  }

  /* ── LISTEN & TAP — hear the word (TTS or recording), pick it ──────── */
  if (mode === 'listen_tap' && correctWord) {
    const options = shuffleOnce([correctWord, ...distractorWords.slice(0, 3)])
    return (
      <motion.div className="flex flex-col items-center gap-5 w-full"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {correctWord.audio_url && <audio ref={audioRef} src={mediaUrl(correctWord.audio_url)!} preload="auto" />}
        <motion.button
          onClick={speakPrompt}
          className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg touch-target"
          whileTap={{ scale: 0.88 }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          aria-label="پخش صدا — دوباره گوش کن"
        >
          <span className="text-5xl">🔊</span>
        </motion.button>
        <p className="font-bold text-gray-700 text-lg persian-text">کدام کلمه را شنیدی؟</p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {options.map(word => {
            const v = wordVisual(word)
            return (
              <OptionButton
                key={word.id}
                label={word.persian}
                emoji={v?.type === 'emoji' ? v.value : undefined}
                imageUrl={v?.type === 'img' ? v.value : undefined}
                isCorrect={word.id === correctWord.id}
                isSelected={selected === word.id}
                feedback={feedback}
                onSelect={() => handleAnswer(word.id, word.id === correctWord.id)}
              />
            )
          })}
        </div>
      </motion.div>
    )
  }

  /* ── NAME IT — show Persian word, pick the matching picture ────────── */
  if (mode === 'name_it' && correctWord) {
    const options = shuffleOnce([correctWord, ...distractorWords.slice(0, 3)])
    return (
      <motion.div className="flex flex-col items-center gap-5 w-full"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => speakPersian(correctWord.persian)}
          className="bg-white rounded-[1.75rem] shadow-md px-8 py-5 text-center touch-target"
          aria-label={`کلمه: ${correctWord.persian}. ضربه بزن تا بشنوی`}
        >
          <span className="text-5xl font-bold text-gray-800">{correctWord.persian}</span>
          <span className="block text-xs text-amber-500 mt-1">🔊 بشنو</span>
        </button>
        <p className="font-bold text-gray-700 text-lg persian-text">کدام تصویر درست است؟</p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {options.map(word => {
            const v = wordVisual(word)
            return (
              <OptionButton
                key={word.id}
                emoji={v?.type === 'emoji' ? v.value : undefined}
                imageUrl={v?.type === 'img' ? v.value : undefined}
                label={feedback !== null ? word.persian : ''}
                isCorrect={word.id === correctWord.id}
                isSelected={selected === word.id}
                feedback={feedback}
                onSelect={() => handleAnswer(word.id, word.id === correctWord.id)}
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

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full py-4 rounded-[1.25rem] bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md touch-target"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
    >
      بعدی ←
    </motion.button>
  )
}

function OptionButton({
  label, emoji, imageUrl, isCorrect, isSelected, feedback, onSelect, bigVisual = false,
}: {
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

  let borderClass = 'border-gray-200 bg-white'
  if (revealResult) borderClass = isCorrect ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
  else if (showCorrect) borderClass = 'border-green-400 bg-green-50'

  return (
    <motion.button
      onClick={onSelect}
      disabled={feedback !== null}
      className={`min-h-[72px] rounded-[1.25rem] border-2 p-3 flex flex-col items-center justify-center gap-1 transition-colors touch-target ${borderClass}`}
      whileTap={feedback === null ? { scale: 0.93 } : {}}
      animate={revealResult && !isCorrect ? { x: [-5, 5, -4, 4, 0] } : {}}
      transition={{ duration: 0.3 }}
      aria-label={label || (isCorrect ? 'گزینه درست' : 'گزینه')}
      aria-pressed={isSelected}
    >
      {imageUrl && <img src={imageUrl} alt="" aria-hidden="true" className={bigVisual ? 'w-20 h-20 object-contain' : 'w-14 h-14 object-contain rounded-lg'} />}
      {!imageUrl && emoji && <span aria-hidden="true" className={bigVisual ? 'text-6xl leading-none' : 'text-4xl leading-none'}>{emoji}</span>}
      {label && <span className="font-bold text-gray-800 text-xl">{label}</span>}
      {revealResult && <span className="text-lg mt-0.5">{isCorrect ? '✅' : '❌'}</span>}
      {showCorrect && <span className="text-lg mt-0.5">✅</span>}
    </motion.button>
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
