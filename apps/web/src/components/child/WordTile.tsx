'use client'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import type { Word } from '@koodakbook/shared'
import { wordEmoji } from '@koodakbook/shared'
import { mediaUrl } from '@/lib/media'
import { playTap } from '@/lib/sounds'
import { speakPersian } from '@/lib/speech'
import { tapMotionFor } from '@/lib/animation'

interface Props {
  word: Word
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export default function WordTile({ word, size = 'md', onClick }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recorded = mediaUrl(word.audio_url)
  const emoji = wordEmoji(word.english)
  const image = mediaUrl(word.image_url)
  // Data-driven tap motion (Phase 0): driven by the row's animation template.
  const tap = tapMotionFor(word.animation_template, word.animation_params)

  function handleClick() {
    playTap()
    // Prefer a recorded clip; otherwise speak the word with TTS
    if (recorded && audioRef.current) audioRef.current.play().catch(() => speakPersian(word.persian))
    else speakPersian(word.persian)
    onClick?.()
  }

  const containerClasses = {
    sm: 'p-3 rounded-[1.25rem]',
    md: 'p-4 rounded-[1.25rem]',
    lg: 'p-6 rounded-[1.75rem]',
  }
  const wordTextSizes = { sm: 'text-2xl', md: 'text-4xl', lg: 'text-5xl' }
  const imgSizes      = { sm: 'w-16 h-16', md: 'w-32 h-32', lg: 'w-56 h-56 mt-2' }
  const emojiSizes    = { sm: 'text-6xl', md: 'text-8xl', lg: 'text-9xl' }

  return (
    <motion.button
      onClick={handleClick}
      className={`flex flex-col items-center gap-2 bg-white shadow-md w-full min-h-[64px] touch-target ${containerClasses[size]}`}
      whileTap={tap.animated ? { scale: tap.scale } : undefined}
      whileHover={{ scale: 1.03 }}
      transition={tap.transition}
      aria-label={`کلمه فارسی: ${word.persian}، به انگلیسی: ${word.english}، ضربه بزن تا بشنوی`}
    >
      {image ? (
        <motion.img
          src={image}
          alt=""
          aria-hidden="true"
          className={`object-contain rounded-xl mb-2 ${imgSizes[size]}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
      ) : emoji ? (
        <motion.span
          aria-hidden="true"
          className={`${emojiSizes[size]} leading-none mb-2`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {emoji}
        </motion.span>
      ) : null}

      <motion.span
        lang="fa"
        className={`font-bold text-gray-800 ${wordTextSizes[size]}`}
        whileTap={{ scale: 1.15, color: '#d4871a' }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      >
        {word.persian}
      </motion.span>
      <span lang="en" className="text-gray-400 text-base ltr">{word.english}</span>
      <span className="text-xs text-amber-500 flex items-center gap-1 mt-0.5" aria-hidden="true">
        🔊 بشنو
      </span>
      {recorded && <audio ref={audioRef} src={recorded} preload="none" />}
    </motion.button>
  )
}
