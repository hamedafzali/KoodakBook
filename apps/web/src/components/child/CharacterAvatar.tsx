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


/** Shared mood motion: idle float, happy hop, excited wiggle — one motion
 *  language for every character (design-system rule). */
function MoodWrap({ mood, size, className, children }: {
  mood: CharacterMood; size: number; className?: string; children: React.ReactNode
}) {
  const anim =
    mood === 'excited' ? { rotate: [-4, 4, -4, 4, 0], scale: [1, 1.08, 1], transition: { duration: 0.5 } }
    : mood === 'happy' ? { y: [0, -10, 0], transition: { duration: 0.6 } }
    : { y: [0, -6, 0], transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const } }
  return (
    <motion.div className={className} style={{ width: size, height: size }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      animate={anim as any}>
      {children}
    </motion.div>
  )
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


/** آوا — the speaking buddy: a cheerful Persian girl, bob hair + hairpin. */
function Ava({ size = 120, mood = 'idle', className }: Omit<Props, 'slug'>) {
  return (
    <MoodWrap mood={mood} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        {/* body / dress */}
        <path d="M40 112c0-16 8-26 20-26s20 10 20 26z" fill="#f472b6" />
        <circle cx="47" cy="98" r="3" fill="#fff" opacity="0.7" />
        <circle cx="60" cy="104" r="3" fill="#fff" opacity="0.7" />
        <circle cx="73" cy="98" r="3" fill="#fff" opacity="0.7" />
        {/* head */}
        <circle cx="60" cy="52" r="26" fill="#fde2c8" />
        {/* hair: rounded bob */}
        <path d="M34 52c0-16 12-28 26-28s26 12 26 28c0-6-4-10-7-11 1 3 1 6 0 8-2-7-8-12-19-12s-17 5-19 12c-1-2-1-5 0-8-3 1-7 5-7 11z" fill="#4a2c17" />
        <path d="M34 52c0 8 3 14 6 16-2-6-2-12-1-16z" fill="#4a2c17" />
        <path d="M86 52c0 8-3 14-6 16 2-6 2-12 1-16z" fill="#4a2c17" />
        {/* hairpin */}
        <circle cx="43" cy="38" r="4" fill="#fbbf24" />
        {/* eyes */}
        <circle cx="51" cy="52" r={mood === 'excited' ? 4 : 3.2} fill="#3b2313" />
        <circle cx="69" cy="52" r={mood === 'excited' ? 4 : 3.2} fill="#3b2313" />
        <circle cx="52.3" cy="50.7" r="1.1" fill="#fff" />
        <circle cx="70.3" cy="50.7" r="1.1" fill="#fff" />
        {/* blush */}
        <ellipse cx="45" cy="60" rx="4" ry="2.5" fill="#fda4af" opacity="0.7" />
        <ellipse cx="75" cy="60" rx="4" ry="2.5" fill="#fda4af" opacity="0.7" />
        {/* mouth — bigger smile when not idle */}
        {mood === 'idle'
          ? <path d="M55 64 Q60 68 65 64" stroke="#b45309" strokeWidth="2" strokeLinecap="round" fill="none" />
          : <path d="M53 63 Q60 71 67 63" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        {/* waving hand when excited */}
        {mood === 'excited' && <circle cx="94" cy="76" r="6" fill="#fde2c8" />}
        {mood === 'excited' && <text x="98" y="62" fontSize="14">👋</text>}
      </svg>
    </MoodWrap>
  )
}

/** پشمک — fluffy cat, the phonics teacher (sharp ears!). */
function Pashmak({ size = 120, mood = 'idle', className }: Omit<Props, 'slug'>) {
  return (
    <MoodWrap mood={mood} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        {/* tail — big and fluffy */}
        <path d="M90 92c18-2 26-16 20-30-6 12-14 16-26 18z" fill="#cbd5e1" />
        <path d="M104 68c-4 8-10 12-18 13l4 10c10-3 16-12 14-23z" fill="#f1f5f9" />
        {/* body */}
        <ellipse cx="58" cy="86" rx="27" ry="21" fill="#cbd5e1" />
        <ellipse cx="58" cy="92" rx="17" ry="12" fill="#f8fafc" />
        {/* head */}
        <circle cx="58" cy="46" r="25" fill="#cbd5e1" />
        {/* fluffy cheeks */}
        <circle cx="38" cy="54" r="7" fill="#cbd5e1" />
        <circle cx="78" cy="54" r="7" fill="#cbd5e1" />
        {/* ears — extra pointy (phonics!) */}
        <path d="M37 32 L32 8 L52 20 Z" fill="#cbd5e1" />
        <path d="M79 32 L84 8 L64 20 Z" fill="#cbd5e1" />
        <path d="M40 28 L37 14 L49 22 Z" fill="#f9a8d4" />
        <path d="M76 28 L79 14 L67 22 Z" fill="#f9a8d4" />
        {/* muzzle */}
        <ellipse cx="58" cy="54" rx="13" ry="9" fill="#f8fafc" />
        {/* eyes */}
        <circle cx="48" cy="44" r={mood === 'excited' ? 4.5 : 3.5} fill="#334155" />
        <circle cx="68" cy="44" r={mood === 'excited' ? 4.5 : 3.5} fill="#334155" />
        <circle cx="49.5" cy="42.5" r="1.2" fill="#fff" />
        <circle cx="69.5" cy="42.5" r="1.2" fill="#fff" />
        {/* nose + mouth */}
        <path d="M55 52 L61 52 L58 56 Z" fill="#f472b6" />
        {mood === 'idle'
          ? <path d="M54 60 Q58 62 62 60" stroke="#334155" strokeWidth="2" strokeLinecap="round" fill="none" />
          : <path d="M52 59 Q58 65 64 59" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        {/* whiskers */}
        <path d="M36 52 L22 49 M36 56 L23 57" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M80 52 L94 49 M80 56 L93 57" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        {/* paws */}
        <ellipse cx="46" cy="104" rx="7" ry="4.5" fill="#cbd5e1" />
        <ellipse cx="70" cy="104" rx="7" ry="4.5" fill="#cbd5e1" />
        {/* musical note when excited (phonics teacher) */}
        {mood === 'excited' && <text x="90" y="26" fontSize="16">🎵</text>}
      </svg>
    </MoodWrap>
  )
}

/** لاکی — the tortoise (خرگوش و لاک‌پشت), the numbers teacher. */
function Laki({ size = 120, mood = 'idle', className }: Omit<Props, 'slug'>) {
  return (
    <MoodWrap mood={mood} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        {/* shell */}
        <path d="M24 84c0-24 16-40 36-40s36 16 36 40z" fill="#16a34a" />
        <path d="M32 84c0-18 12-31 28-31s28 13 28 31z" fill="#4ade80" />
        {/* shell pattern */}
        <path d="M60 53v31 M42 62l10 22 M78 62l-10 22" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M38 74h44" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
        {/* head */}
        <circle cx="60" cy="34" r="16" fill="#86efac" />
        {/* eyes */}
        <circle cx="54" cy="31" r={mood === 'excited' ? 3.8 : 3} fill="#14532d" />
        <circle cx="66" cy="31" r={mood === 'excited' ? 3.8 : 3} fill="#14532d" />
        <circle cx="55" cy="29.8" r="1" fill="#fff" />
        <circle cx="67" cy="29.8" r="1" fill="#fff" />
        {/* mouth */}
        {mood === 'idle'
          ? <path d="M55 39 Q60 42 65 39" stroke="#14532d" strokeWidth="2" strokeLinecap="round" fill="none" />
          : <path d="M53 38 Q60 45 67 38" stroke="#14532d" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        {/* blush */}
        <ellipse cx="48" cy="37" rx="3" ry="2" fill="#fda4af" opacity="0.6" />
        <ellipse cx="72" cy="37" rx="3" ry="2" fill="#fda4af" opacity="0.6" />
        {/* legs */}
        <ellipse cx="34" cy="92" rx="8" ry="6" fill="#86efac" />
        <ellipse cx="86" cy="92" rx="8" ry="6" fill="#86efac" />
        <ellipse cx="46" cy="98" rx="8" ry="6" fill="#86efac" />
        <ellipse cx="74" cy="98" rx="8" ry="6" fill="#86efac" />
        {/* ground */}
        <ellipse cx="60" cy="104" rx="42" ry="5" fill="#16a34a" opacity="0.15" />
        {/* counting badge when excited */}
        {mood === 'excited' && <text x="88" y="30" fontSize="14" fontWeight="bold" fill="#166534">۱۲۳</text>}
      </svg>
    </MoodWrap>
  )
}

export default function CharacterAvatar({ slug, size = 120, mood = 'idle', className }: Props) {
  if (slug === 'roozi') return <Roozi size={size} mood={mood} className={className} />
  if (slug === 'ava') return <Ava size={size} mood={mood} className={className} />
  if (slug === 'pashmak') return <Pashmak size={size} mood={mood} className={className} />
  if (slug === 'laki') return <Laki size={size} mood={mood} className={className} />
  // Simorgh (and any unknown slug) → the existing mascot artwork
  const mascotMood = mood === 'excited' ? 'excited' : mood === 'happy' ? 'happy' : 'idle'
  return <Mascot size={size} mood={mascotMood} className={className} />
}
