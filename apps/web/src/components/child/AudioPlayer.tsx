'use client'
import { useEffect, useRef } from 'react'

interface Props {
  src: string
  autoPlay?: boolean
  className?: string
  label?: string
}

export default function AudioPlayer({ src, autoPlay = false, className, label }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (autoPlay && audioRef.current) audioRef.current.play().catch(() => {})
  }, [src, autoPlay])

  return (
    <button
      onClick={() => { audioRef.current?.play() }}
      className={`flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full px-4 py-2 text-sm font-medium transition ${className ?? ''}`}
      aria-label={label ?? 'پخش صدا'}
    >
      <span className="text-lg">🔊</span>
      {label && <span>{label}</span>}
      <audio ref={audioRef} src={src} preload="none" />
    </button>
  )
}
