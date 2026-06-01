'use client'
import { motion } from 'framer-motion'

interface Props {
  size?: number
  mood?: 'happy' | 'excited' | 'idle'
  className?: string
}

// Simorgh — Persian mythical bird, friendly and colorful
export default function Mascot({ size = 120, mood = 'idle', className }: Props) {
  const float = mood !== 'excited' ? {
    y: [0, -8, 0] as number[],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' as const },
  } : {}

  const excited = mood === 'excited' ? {
    rotate: [-5, 5, -5, 5, 0] as number[],
    scale: [1, 1.1, 1] as number[],
    transition: { duration: 0.5 },
  } : {}

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size }}
      animate={mood === 'excited' ? excited : float as any}
    >
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        {/* Tail feathers */}
        <ellipse cx="30" cy="95" rx="18" ry="8" transform="rotate(-30 30 95)" fill="#ef4444" opacity="0.85"/>
        <ellipse cx="42" cy="100" rx="18" ry="7" transform="rotate(-15 42 100)" fill="#f97316" opacity="0.85"/>
        <ellipse cx="55" cy="103" rx="18" ry="7" fill="#eab308" opacity="0.85"/>
        <ellipse cx="68" cy="100" rx="18" ry="7" transform="rotate(15 68 100)" fill="#22c55e" opacity="0.85"/>
        <ellipse cx="80" cy="95" rx="18" ry="8" transform="rotate(30 80 95)" fill="#3b82f6" opacity="0.85"/>

        {/* Wing right */}
        <ellipse cx="88" cy="65" rx="22" ry="12" transform="rotate(20 88 65)" fill="#fb923c"/>
        <ellipse cx="86" cy="63" rx="16" ry="9" transform="rotate(20 86 63)" fill="#fdba74"/>

        {/* Wing left */}
        <ellipse cx="32" cy="65" rx="22" ry="12" transform="rotate(-20 32 65)" fill="#fb923c"/>
        <ellipse cx="34" cy="63" rx="16" ry="9" transform="rotate(-20 34 63)" fill="#fdba74"/>

        {/* Body */}
        <ellipse cx="60" cy="72" rx="26" ry="28" fill="#f97316"/>
        <ellipse cx="60" cy="75" rx="18" ry="20" fill="#fed7aa"/>

        {/* Chest pattern */}
        <ellipse cx="60" cy="80" rx="10" ry="12" fill="#fef3c7" opacity="0.6"/>

        {/* Head */}
        <circle cx="60" cy="42" r="22" fill="#f97316"/>

        {/* Crest feathers */}
        <ellipse cx="52" cy="22" rx="5" ry="12" transform="rotate(-15 52 22)" fill="#ef4444"/>
        <ellipse cx="60" cy="20" rx="5" ry="13" fill="#eab308"/>
        <ellipse cx="68" cy="22" rx="5" ry="12" transform="rotate(15 68 22)" fill="#3b82f6"/>

        {/* Eyes */}
        <circle cx="50" cy="40" r="7" fill="white"/>
        <circle cx="70" cy="40" r="7" fill="white"/>
        <motion.circle
          cx="52" cy="41" r="4" fill="#1e293b"
          animate={mood === 'happy' || mood === 'excited' ? { scaleY: 0.5, y: 1 } : { scaleY: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        />
        <motion.circle
          cx="72" cy="41" r="4" fill="#1e293b"
          animate={mood === 'happy' || mood === 'excited' ? { scaleY: 0.5, y: 1 } : { scaleY: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        />
        {/* Eye shine */}
        <circle cx="53" cy="39" r="1.5" fill="white"/>
        <circle cx="73" cy="39" r="1.5" fill="white"/>

        {/* Beak */}
        <path d="M 54 50 Q 60 56 66 50 L 60 58 Z" fill="#d97706"/>

        {/* Cheeks */}
        <circle cx="44" cy="46" r="5" fill="#fca5a5" opacity="0.5"/>
        <circle cx="76" cy="46" r="5" fill="#fca5a5" opacity="0.5"/>

        {/* Feet */}
        <path d="M 50 98 L 46 108 M 50 98 L 50 108 M 50 98 L 54 108" stroke="#d97706" strokeWidth="3" strokeLinecap="round"/>
        <path d="M 70 98 L 66 108 M 70 98 L 70 108 M 70 98 L 74 108" stroke="#d97706" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </motion.div>
  )
}
