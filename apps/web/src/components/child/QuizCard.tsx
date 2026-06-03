'use client'
import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Word, Letter } from '@koodakbook/shared'
import { mediaUrl } from '@/lib/media'
import { playTap, playSuccess } from '@/lib/sounds'

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

export default function QuizCard({ question, onCorrect, onIncorrect, onFlashcardNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { mode, correctWord, correctLetter, distractorWords = [], distractorLetters = [] } = question

  const handleAnswer = useCallback((id: string, isCorrect: boolean) => {
    if (feedback !== null) return
    setSelected(id)
    setFeedback(isCorrect ? 'correct' : 'incorrect')

    if (isCorrect) {
      playSuccess()
      setTimeout(onCorrect, 900)
    } else {
      playErrorSound()
      setTimeout(onIncorrect, 900)
    }
  }, [feedback, onCorrect, onIncorrect])

  function playAudio() {
    playTap()
    if (audioRef.current) audioRef.current.play().catch(() => {})
  }

  /* ── FLASHCARD mode ────────────────────────────────────────────────── */
  if (mode === 'flashcard') {
    if (correctWord) {
      return (
        <motion.div
          className="flex flex-col items-center gap-4 w-full"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
        >
          <motion.button
            onClick={() => { playTap(); if (correctWord.audio_url && audioRef.current) audioRef.current.play().catch(() => {}) }}
            className="w-full bg-white rounded-[1.75rem] shadow-lg p-6 flex flex-col items-center gap-3 touch-target"
            whileTap={{ scale: 0.96 }}
            aria-label={`کلمه فارسی: ${correctWord.persian}`}
          >
            {mediaUrl(correctWord.image_url) && (
              <img
                src={mediaUrl(correctWord.image_url)!}
                alt={correctWord.english}
                className="w-48 h-48 object-contain rounded-2xl"
              />
            )}
            <span className="text-5xl font-bold text-gray-800">{correctWord.persian}</span>
            <span className="text-base text-gray-400 ltr">{correctWord.english}</span>
            {correctWord.audio_url && (
              <span className="text-xs text-amber-500 flex items-center gap-1"><span>🔊</span> ضربه بزن تا بشنوی</span>
            )}
          </motion.button>
          {correctWord.audio_url && <audio ref={audioRef} src={mediaUrl(correctWord.audio_url)!} preload="none" />}
          <motion.button
            onClick={onFlashcardNext}
            className="w-full py-4 rounded-[1.25rem] bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md touch-target"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
          >
            بعدی ←
          </motion.button>
        </motion.div>
      )
    }
    if (correctLetter) {
      return (
        <motion.div
          className="flex flex-col items-center gap-4 w-full"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.button
            onClick={() => { playTap(); if (correctLetter.audio_url && audioRef.current) audioRef.current.play().catch(() => {}) }}
            className="w-full bg-white rounded-[1.75rem] shadow-lg p-8 flex flex-col items-center gap-2 touch-target"
            whileTap={{ scale: 0.96 }}
            aria-label={`حرف فارسی: ${correctLetter.name_persian}`}
          >
            <span className="text-7xl font-bold text-gray-800">{correctLetter.character}</span>
            <span className="text-xl text-gray-600">{correctLetter.name_persian}</span>
            <span className="text-sm text-gray-400 ltr">{correctLetter.name_english}</span>
          </motion.button>
          {correctLetter.audio_url && <audio ref={audioRef} src={mediaUrl(correctLetter.audio_url)!} preload="none" />}
          <motion.button
            onClick={onFlashcardNext}
            className="w-full py-4 rounded-[1.25rem] bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md touch-target"
            whileTap={{ scale: 0.96 }}
          >
            بعدی ←
          </motion.button>
        </motion.div>
      )
    }
  }

  /* ── MATCH IMAGE mode — image shown, pick correct Persian word ─────── */
  if (mode === 'match_image' && correctWord) {
    const options = shuffleOnce([correctWord, ...distractorWords.slice(0, 3)])
    return (
      <motion.div
        className="flex flex-col items-center gap-5 w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-full bg-white rounded-[1.75rem] shadow-md p-4 flex items-center justify-center">
          {mediaUrl(correctWord.image_url) ? (
            <img
              src={mediaUrl(correctWord.image_url)!}
              alt="این چیست؟"
              className="w-44 h-44 object-contain rounded-xl"
            />
          ) : (
            <span className="text-8xl">{correctWord.persian}</span>
          )}
        </div>
        <p className="font-bold text-gray-700 text-lg persian-text">این چه کلمه‌ای است؟</p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {options.map(word => {
            const isCorrectOption = word.id === correctWord.id
            const isSelected = selected === word.id
            return (
              <OptionButton
                key={word.id}
                label={word.persian}
                isCorrect={isCorrectOption}
                isSelected={isSelected}
                feedback={feedback}
                onSelect={() => handleAnswer(word.id, isCorrectOption)}
              />
            )
          })}
        </div>
      </motion.div>
    )
  }

  /* ── LISTEN & TAP mode — audio plays, pick correct word ────────────── */
  if (mode === 'listen_tap' && correctWord) {
    const options = shuffleOnce([correctWord, ...distractorWords.slice(0, 3)])
    return (
      <motion.div
        className="flex flex-col items-center gap-5 w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {correctWord.audio_url && <audio ref={audioRef} src={mediaUrl(correctWord.audio_url)!} preload="auto" />}
        <motion.button
          onClick={playAudio}
          className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg touch-target"
          whileTap={{ scale: 0.88 }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          aria-label="پخش صدا"
        >
          <span className="text-5xl">🔊</span>
        </motion.button>
        <p className="font-bold text-gray-700 text-lg persian-text">کدام کلمه را شنیدی؟</p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {options.map(word => {
            const isCorrectOption = word.id === correctWord.id
            const isSelected = selected === word.id
            return (
              <OptionButton
                key={word.id}
                label={word.persian}
                sublabel={mediaUrl(word.image_url) ? undefined : word.english}
                imageUrl={mediaUrl(word.image_url) ?? undefined}
                isCorrect={isCorrectOption}
                isSelected={isSelected}
                feedback={feedback}
                onSelect={() => handleAnswer(word.id, isCorrectOption)}
              />
            )
          })}
        </div>
      </motion.div>
    )
  }

  /* ── NAME IT mode — show Persian word, pick correct image ──────────── */
  if (mode === 'name_it' && correctWord) {
    const options = shuffleOnce([correctWord, ...distractorWords.slice(0, 3)])
    return (
      <motion.div
        className="flex flex-col items-center gap-5 w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="bg-white rounded-[1.75rem] shadow-md px-8 py-5 text-center">
          <span className="text-5xl font-bold text-gray-800">{correctWord.persian}</span>
        </div>
        <p className="font-bold text-gray-700 text-lg persian-text">کدام تصویر درست است؟</p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {options.map(word => {
            const isCorrectOption = word.id === correctWord.id
            const isSelected = selected === word.id
            return (
              <OptionButton
                key={word.id}
                imageUrl={mediaUrl(word.image_url) ?? undefined}
                label={feedback !== null ? word.persian : ''}
                isCorrect={isCorrectOption}
                isSelected={isSelected}
                feedback={feedback}
                onSelect={() => handleAnswer(word.id, isCorrectOption)}
                imageOnly={!mediaUrl(word.image_url)}
                fallbackLabel={word.english}
              />
            )
          })}
        </div>
      </motion.div>
    )
  }

  return null
}

/* ── Option Button ─────────────────────────────────────────────────────────── */
function OptionButton({
  label,
  sublabel,
  imageUrl,
  isCorrect,
  isSelected,
  feedback,
  onSelect,
  imageOnly = false,
  fallbackLabel,
}: {
  label: string
  sublabel?: string
  imageUrl?: string
  isCorrect: boolean
  isSelected: boolean
  feedback: 'correct' | 'incorrect' | null
  onSelect: () => void
  imageOnly?: boolean
  fallbackLabel?: string
}) {
  const revealResult = feedback !== null && isSelected
  const showCorrect = feedback !== null && isCorrect && !isSelected

  let borderClass = 'border-gray-200 bg-white'
  if (revealResult) {
    borderClass = isCorrect
      ? 'border-green-400 bg-green-50'
      : 'border-red-400 bg-red-50'
  } else if (showCorrect) {
    borderClass = 'border-green-400 bg-green-50'
  }

  return (
    <motion.button
      onClick={onSelect}
      disabled={feedback !== null}
      className={`min-h-[64px] rounded-[1.25rem] border-2 p-3 flex flex-col items-center justify-center gap-1 transition-colors touch-target ${borderClass}`}
      whileTap={feedback === null ? { scale: 0.93 } : {}}
      animate={revealResult && !isCorrect ? { x: [-5, 5, -4, 4, 0] } : {}}
      transition={{ duration: 0.3 }}
      aria-label={label || fallbackLabel || ''}
      aria-pressed={isSelected}
    >
      {imageUrl && (
        <img src={imageUrl} alt={label} className="w-14 h-14 object-contain rounded-lg" />
      )}
      {!imageOnly && label && (
        <span className="font-bold text-gray-800 text-xl">{label}</span>
      )}
      {sublabel && <span className="text-xs text-gray-400 ltr">{sublabel}</span>}
      {imageOnly && !imageUrl && fallbackLabel && (
        <span className="text-sm text-gray-500">{fallbackLabel}</span>
      )}
      {revealResult && (
        <span className="text-lg mt-0.5">{isCorrect ? '✅' : '❌'}</span>
      )}
      {showCorrect && <span className="text-lg mt-0.5">✅</span>}
    </motion.button>
  )
}

/* Shuffle array once (stable during re-renders by not depending on state) */
function shuffleOnce<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
