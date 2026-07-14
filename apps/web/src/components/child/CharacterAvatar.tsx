'use client'
import { motion } from 'framer-motion'
import Mascot from './Mascot'

/* Character visuals (character-system plan §3): layered SVG per character,
 * mood-driven via framer-motion — the Simorgh pattern. V2 swaps individual
 * characters to Rive without touching call sites (slug → component map). */

export type CharacterMood = 'idle' | 'happy' | 'excited' | 'encouraging'

interface Props {
  slug: string
  size?: number
  mood?: CharacterMood
  className?: string
}

/** Roozi the fox — vocabulary teacher. Same flat, layered style as Simorgh. */
function Roozi({ size = 120, mood = 'idle', className }: Omit<Props, 'slug'>) {
  const float = mood === 'idle' || mood === 'encouraging' ? {
    y: [0, -6, 0] as number[],
    transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const },
  } : {}
  const excited = mood === 'excited' ? {
    rotate: [-4, 4, -4, 4, 0] as number[],
    scale: [1, 1.08, 1] as number[],
    transition: { duration: 0.5 },
  } : {}
  const happy = mood === 'happy' ? {
    y: [0, -10, 0] as number[],
    transition: { duration: 0.6 },
  } : {}

  return (
    <motion.div className={className} style={{ width: size, height: size }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      animate={(mood === 'excited' ? excited : mood === 'happy' ? happy : float) as any}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        {/* tail */}
        <path d="M92 88c16-4 22-18 18-30-8 10-14 12-24 14z" fill="#fb923c" />
        <path d="M104 62c-3 8-8 12-16 14l6 8c8-4 12-12 10-22z" fill="#fff7ed" opacity="0.9" />
        {/* body */}
        <ellipse cx="60" cy="82" rx="26" ry="22" fill="#f97316" />
        <ellipse cx="60" cy="88" rx="16" ry="13" fill="#fff7ed" />
        {/* head */}
        <circle cx="60" cy="46" r="24" fill="#fb923c" />
        {/* ears */}
        <path d="M38 32 L34 10 L52 22 Z" fill="#fb923c" />
        <path d="M82 32 L86 10 L68 22 Z" fill="#fb923c" />
        <path d="M40 28 L38 16 L48 23 Z" fill="#7c2d12" />
        <path d="M80 28 L82 16 L72 23 Z" fill="#7c2d12" />
        {/* cheeks/muzzle */}
        <ellipse cx="60" cy="54" rx="14" ry="10" fill="#fff7ed" />
        {/* eyes */}
        <circle cx="50" cy="43" r={mood === 'excited' ? 4.5 : 3.5} fill="#431407" />
        <circle cx="70" cy="43" r={mood === 'excited' ? 4.5 : 3.5} fill="#431407" />
        <circle cx="51.5" cy="41.5" r="1.2" fill="#fff" />
        <circle cx="71.5" cy="41.5" r="1.2" fill="#fff" />
        {/* nose + mouth */}
        <ellipse cx="60" cy="52" rx="3.5" ry="2.8" fill="#431407" />
        {mood === 'idle'
          ? <path d="M56 58 Q60 61 64 58" stroke="#431407" strokeWidth="2" strokeLinecap="round" fill="none" />
          : <path d="M54 57 Q60 64 66 57" stroke="#431407" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        {/* front paws */}
        <ellipse cx="48" cy="100" rx="7" ry="5" fill="#fb923c" />
        <ellipse cx="72" cy="100" rx="7" ry="5" fill="#fb923c" />
        {/* sparkle when excited */}
        {mood === 'excited' && <text x="88" y="26" fontSize="16">✨</text>}
      </svg>
    </motion.div>
  )
}

export default function CharacterAvatar({ slug, size = 120, mood = 'idle', className }: Props) {
  if (slug === 'roozi') return <Roozi size={size} mood={mood} className={className} />
  // Simorgh (and any unknown slug) → the existing mascot artwork
  const mascotMood = mood === 'excited' ? 'excited' : mood === 'happy' ? 'happy' : 'idle'
  return <Mascot size={size} mood={mascotMood} className={className} />
}
