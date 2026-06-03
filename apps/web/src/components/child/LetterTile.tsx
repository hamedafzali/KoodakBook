'use client'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import type { Letter } from '@koodakbook/shared'
import { mediaUrl } from '@/lib/media'
import { playTap } from '@/lib/sounds'
import { speakPersian } from '@/lib/speech'

interface Props {
  letter: Letter
  onClick?: () => void
}

const GROUP_COLORS: Record<number, string> = {
  1: 'bg-red-100 border-red-300 text-red-700',
  2: 'bg-orange-100 border-orange-300 text-orange-700',
  3: 'bg-yellow-100 border-yellow-300 text-yellow-700',
  4: 'bg-green-100 border-green-300 text-green-700',
  5: 'bg-teal-100 border-teal-300 text-teal-700',
  6: 'bg-blue-100 border-blue-300 text-blue-700',
  7: 'bg-indigo-100 border-indigo-300 text-indigo-700',
  8: 'bg-purple-100 border-purple-300 text-purple-700',
}

export default function LetterTile({ letter, onClick }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const color = GROUP_COLORS[letter.group] ?? 'bg-gray-100 border-gray-300 text-gray-700'

  function handleClick() {
    playTap()
    // Prefer recorded audio; otherwise speak the letter name with TTS
    if (letter.audio_url && audioRef.current) audioRef.current.play().catch(() => speakPersian(letter.name_persian))
    else speakPersian(letter.name_persian)
    onClick?.()
  }

  return (
    <motion.button
      onClick={handleClick}
      className={`flex flex-col items-center gap-1 p-5 rounded-[1.25rem] border-2 shadow-sm w-full min-h-[100px] touch-target ${color}`}
      whileTap={{ scale: 0.85, rotate: [-2, 2, -1, 0] }}
      whileHover={{ scale: 1.05, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      aria-label={`حرف ${letter.name_persian}، به انگلیسی ${letter.name_english}${letter.audio_url ? '، ضربه بزن تا بشنوی' : ''}`}
    >
      <motion.span
        lang="fa"
        className="text-5xl font-bold"
        aria-hidden="true"
        whileTap={{ scale: 1.3 }}
        transition={{ type: 'spring', stiffness: 500, damping: 12 }}
      >
        {letter.character}
      </motion.span>
      <span lang="fa" className="text-sm font-medium">{letter.name_persian}</span>
      <span lang="en" className="text-xs ltr opacity-70">{letter.name_english}</span>
      {letter.audio_url && <audio ref={audioRef} src={mediaUrl(letter.audio_url)!} preload="none" />}
    </motion.button>
  )
}
