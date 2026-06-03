'use client'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import type { Word } from '@koodakbook/shared'
import { mediaUrl } from '@/lib/media'
import { playTap } from '@/lib/sounds'

interface Props {
  word: Word
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export default function WordTile({ word, size = 'md', onClick }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  async function handleClick() {
    playTap()
    if (word.audio_url && audioRef.current) audioRef.current.play().catch(() => {})
    onClick?.()
  }

  const containerClasses = {
    sm: 'p-3 rounded-[1.25rem]',
    md: 'p-4 rounded-[1.25rem]',
    lg: 'p-6 rounded-[1.75rem]',
  }
  const wordTextSizes = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl',
  }
  const imgSizes = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-56 h-56 mt-2',
  }

  return (
    <motion.button
      onClick={handleClick}
      className={`flex flex-col items-center gap-2 bg-white shadow-md w-full min-h-[64px] touch-target ${containerClasses[size]}`}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      aria-label={`کلمه فارسی: ${word.persian}، به انگلیسی: ${word.english}${word.audio_url ? '، ضربه بزن تا بشنوی' : ''}`}
    >
      {mediaUrl(word.image_url) && (
        <motion.img
          src={mediaUrl(word.image_url)!}
          alt=""
          aria-hidden="true"
          className={`object-contain rounded-xl mb-2 ${imgSizes[size]}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
      <motion.span
        lang="fa"
        className={`font-bold text-gray-800 ${wordTextSizes[size]}`}
        whileTap={{ scale: 1.15, color: '#d4871a' }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      >
        {word.persian}
      </motion.span>
      <span lang="en" className="text-gray-400 text-base ltr">{word.english}</span>
      {word.audio_url && (
        <span className="text-xs text-amber-500 flex items-center gap-1 mt-0.5" aria-hidden="true">
          🔊 بشنو
        </span>
      )}
      {word.audio_url && <audio ref={audioRef} src={mediaUrl(word.audio_url)!} preload="none" />}
    </motion.button>
  )
}
