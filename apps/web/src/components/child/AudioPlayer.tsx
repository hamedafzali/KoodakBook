'use client'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  src: string
  autoPlay?: boolean
  className?: string
  label?: string
}

export default function AudioPlayer({ src, autoPlay = false, className, label }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onPlay  = () => setPlaying(true)
    const onEnded = () => setPlaying(false)
    const onPause = () => setPlaying(false)
    el.addEventListener('play',  onPlay)
    el.addEventListener('ended', onEnded)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('play',  onPlay)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('pause', onPause)
    }
  }, [])

  useEffect(() => {
    if (autoPlay && audioRef.current) audioRef.current.play().catch(() => {})
  }, [src, autoPlay])

  function handleClick() {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause(); el.currentTime = 0 }
    else el.play().catch(() => {})
  }

  const ariaLabel = playing
    ? `توقف ${label ?? 'صدا'}`
    : `پخش ${label ?? 'صدا'}`

  return (
    <motion.button
      onClick={handleClick}
      whileTap={{ scale: 0.9 }}
      className={`flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-full px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] touch-target ${className ?? ''}`}
      aria-label={ariaLabel}
      aria-pressed={playing}
    >
      <motion.span
        className="text-lg"
        aria-hidden="true"
        animate={playing ? { scale: [1, 1.2, 1] } : { scale: 1 }}
        transition={{ duration: 0.6, repeat: playing ? Infinity : 0 }}
      >
        {playing ? '⏸' : '🔊'}
      </motion.span>
      {label && <span>{label}</span>}
      <audio ref={audioRef} src={src} preload="none" />
    </motion.button>
  )
}
