'use client'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import Mascot from './Mascot'

/* Character visuals + ACTING — illustration-grade "premium flat".
 * Flat vectors keep the rig cheap and razor-sharp at any size, but every
 * character now carries form gradients, a ground shadow, rim light, glossy eyes,
 * blush and secondary detail so it reads as *illustrated*, not clip-art.
 *
 * The animation is fully parametric — same three inputs at every call site:
 *  - mood   : idle | happy | excited | encouraging | thinking  (body acting)
 *  - talking: speech bob + generic mouth flap while audio plays
 *  - mouth  : 0..1 viseme openness from a Performance track (sentence-matched)
 * plus autonomous blinking. Each character also has a *signature accent* that
 * pops on `excited` (Roozi ✨, Ava 👋, Pashmak 🎵, Laki ۱۲۳, Tondpa 🌈,
 * Boomi الف, Khersi 💛). V-next swaps individuals to Rive state machines behind
 * these very inputs — no call site changes. */

export type CharacterMood = 'idle' | 'happy' | 'excited' | 'encouraging' | 'thinking'

interface Props {
  slug: string
  size?: number
  mood?: CharacterMood
  talking?: boolean
  /** Driven viseme openness 0..1 from a performance track (useActing). When set,
   *  the mouth follows the actual words instead of the generic `talking` loop. */
  mouth?: number
  className?: string
}
type CharProps = Omit<Props, 'slug'>

/** Shared motion: talking bob beats mood; excited wiggle; happy hop; idle float. */
function MoodWrap({ mood = 'idle', talking, size = 120, className, children }: CharProps & { children: React.ReactNode }) {
  const anim =
    talking ? { y: [0, -3, 0], transition: { duration: 0.34, repeat: Infinity, ease: 'easeInOut' as const } }
    : mood === 'excited' ? { rotate: [-4, 4, -4, 4, 0], scale: [1, 1.08, 1], transition: { duration: 0.5 } }
    : mood === 'happy' ? { y: [0, -10, 0], transition: { duration: 0.6 } }
    : mood === 'thinking' ? { rotate: [-2.5, 2.5, -2.5], transition: { duration: 1.9, repeat: Infinity, ease: 'easeInOut' as const } }
    : { y: [0, -6, 0], transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const } }
  return (
    <motion.div className={className} style={{ width: size, height: size, position: 'relative' }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      animate={anim as any}>
      {children}
      {mood === 'thinking' && !talking && (
        <motion.span aria-hidden
          style={{ position: 'absolute', top: -size * 0.06, left: 0, fontSize: size * 0.22, lineHeight: 1 }}
          animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>
          💭
        </motion.span>
      )}
    </motion.div>
  )
}

/** Eyelid overlay in the head color — blinks every few seconds, offset per
 *  instance so a row of characters never blinks in unison. */
function Blink({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  const delay = useMemo(() => Math.random() * 2.5, [])
  return (
    <motion.rect x={x} y={y} width={w} height={h} rx={h / 2} fill={color}
      style={{ transformBox: 'fill-box', transformOrigin: 'center top' }}
      initial={{ scaleY: 0 }}
      animate={{ scaleY: [0, 0, 1, 0, 0] }}
      transition={{ duration: 4.2, times: [0, 0.9, 0.94, 0.98, 1], repeat: Infinity, delay }}
    />
  )
}

/** Viseme-lite mouth: an open-mouth ellipse whose height pulses while the
 *  character's audio actually plays — reads as speech at this art scale. */
function TalkMouth({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <motion.ellipse cx={cx} cy={cy} rx={4.5} ry={3.5} fill={color}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      animate={{ scaleY: [0.3, 1, 0.45, 0.9, 0.3] }}
      transition={{ duration: 0.42, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

/** Driven viseme mouth: openness comes from a performance track (0..1), so the
 *  mouth matches the actual words. Beats the generic `talking` loop when set. */
function Mouth({ cx, cy, color, open }: { cx: number; cy: number; color: string; open: number }) {
  const o = Math.max(0, Math.min(1, open))
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={4.8} ry={1 + o * 4} fill={color} />
      {o > 0.35 && <ellipse cx={cx} cy={cy + 1 + o * 2} rx={3} ry={o * 1.6} fill="#f472b6" opacity={0.8} />}
    </g>
  )
}

/** Roozi the fox — vocabulary teacher. Warm, curious, quick. */
function Roozi({ size = 120, mood = 'idle', talking, mouth, className }: CharProps) {
  const er = mood === 'excited' ? 4.8 : 4.2
  return (
    <MoodWrap mood={mood} talking={talking} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        <defs>
          <radialGradient id="fxHead" cx="40%" cy="30%" r="76%">
            <stop offset="0" stopColor="#fed7aa" /><stop offset="0.5" stopColor="#fb923c" /><stop offset="1" stopColor="#ef7314" />
          </radialGradient>
          <radialGradient id="fxBody" cx="42%" cy="32%" r="78%">
            <stop offset="0" stopColor="#fdba74" /><stop offset="0.55" stopColor="#fb923c" /><stop offset="1" stopColor="#e26810" />
          </radialGradient>
          <linearGradient id="fxCream" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffaf3" /><stop offset="1" stopColor="#ffe9cf" />
          </linearGradient>
          <radialGradient id="fxEar" cx="50%" cy="25%" r="80%">
            <stop offset="0" stopColor="#b1450f" /><stop offset="1" stopColor="#7c2d12" />
          </radialGradient>
          <radialGradient id="fxTail" cx="70%" cy="30%" r="80%">
            <stop offset="0" stopColor="#fdba74" /><stop offset="1" stopColor="#ea7317" />
          </radialGradient>
          <radialGradient id="fxEye" cx="36%" cy="30%" r="75%">
            <stop offset="0" stopColor="#5c3626" /><stop offset="1" stopColor="#2a1206" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="113" rx="30" ry="5" fill="#000" opacity="0.09" />
        <path d="M92 88c16-4 22-18 18-30-8 10-14 12-26 18z" fill="url(#fxTail)" />
        <path d="M104 62c-3 8-8 12-16 14l6 8c8-4 12-12 10-22z" fill="url(#fxCream)" opacity="0.95" />
        <ellipse cx="60" cy="82" rx="26" ry="22" fill="url(#fxBody)" />
        <path d="M40 74a26 22 0 0 1 20-14" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" fill="none" />
        <ellipse cx="60" cy="88" rx="16" ry="13" fill="url(#fxCream)" />
        <path d="M38 32 L34 10 L52 22 Z" fill="url(#fxEar)" />
        <path d="M82 32 L86 10 L68 22 Z" fill="url(#fxEar)" />
        <path d="M40 28 L38 16 L48 23 Z" fill="#93330f" />
        <path d="M80 28 L82 16 L72 23 Z" fill="#93330f" />
        <circle cx="60" cy="46" r="24" fill="url(#fxHead)" />
        <path d="M44 34a24 24 0 0 1 14-8" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="60" cy="54" rx="14" ry="10" fill="url(#fxCream)" />
        <ellipse cx="44" cy="52" rx="4.5" ry="3" fill="#fb7185" opacity="0.32" />
        <ellipse cx="76" cy="52" rx="4.5" ry="3" fill="#fb7185" opacity="0.32" />
        <circle cx="50" cy="43" r={er} fill="url(#fxEye)" />
        <circle cx="70" cy="43" r={er} fill="url(#fxEye)" />
        <circle cx="51.6" cy="41.2" r="1.5" fill="#fff" />
        <circle cx="71.6" cy="41.2" r="1.5" fill="#fff" />
        <circle cx="48.8" cy="44.6" r="0.7" fill="#fff" opacity="0.6" />
        <circle cx="68.8" cy="44.6" r="0.7" fill="#fff" opacity="0.6" />
        <Blink x={44} y={38} w={12} h={9} color="#fb923c" />
        <Blink x={64} y={38} w={12} h={9} color="#fb923c" />
        <ellipse cx="60" cy="52" rx="3.6" ry="2.9" fill="#3a1206" />
        <ellipse cx="58.8" cy="50.9" rx="1" ry="0.8" fill="#fff" opacity="0.5" />
        {mouth != null ? <Mouth cx={60} cy={59} color="#431407" open={mouth} />
          : talking ? <TalkMouth cx={60} cy={59} color="#431407" />
          : mood === 'idle'
            ? <path d="M56 58 Q60 61 64 58" stroke="#431407" strokeWidth="2" strokeLinecap="round" fill="none" />
            : <path d="M54 57 Q60 64 66 57" stroke="#431407" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        <path d="M34 52 h-9 M35 56 l-9 2" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" />
        <path d="M86 52 h9 M85 56 l9 2" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" />
        <ellipse cx="48" cy="100" rx="7" ry="5" fill="url(#fxBody)" />
        <ellipse cx="72" cy="100" rx="7" ry="5" fill="url(#fxBody)" />
        {mood === 'excited' && !talking && <text x="88" y="26" fontSize="16">✨</text>}
      </svg>
    </MoodWrap>
  )
}

/** آوا — the speaking buddy. Bright, chatty, full of song. */
function Ava({ size = 120, mood = 'idle', talking, mouth, className }: CharProps) {
  const er = mood === 'excited' ? 4 : 3.2
  return (
    <MoodWrap mood={mood} talking={talking} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        <defs>
          <radialGradient id="avSkin" cx="42%" cy="34%" r="72%">
            <stop offset="0" stopColor="#ffeadd" /><stop offset="1" stopColor="#f7cba8" />
          </radialGradient>
          <linearGradient id="avHair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b3826" /><stop offset="1" stopColor="#3a2213" />
          </linearGradient>
          <linearGradient id="avShirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fb7fbe" /><stop offset="1" stopColor="#ec4899" />
          </linearGradient>
          <radialGradient id="avEye" cx="38%" cy="30%" r="72%">
            <stop offset="0" stopColor="#5a3b28" /><stop offset="1" stopColor="#2f1c10" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="114" rx="26" ry="4.5" fill="#000" opacity="0.09" />
        <path d="M40 112c0-16 8-26 20-26s20 10 20 26z" fill="url(#avShirt)" />
        <circle cx="47" cy="98" r="3" fill="#fff" opacity="0.7" />
        <circle cx="60" cy="104" r="3" fill="#fff" opacity="0.7" />
        <circle cx="73" cy="98" r="3" fill="#fff" opacity="0.7" />
        <circle cx="60" cy="52" r="26" fill="url(#avSkin)" />
        <path d="M44 34a26 26 0 0 1 14-9" stroke="#fff" strokeOpacity="0.4" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M34 52c0-16 12-28 26-28s26 12 26 28c0-6-4-10-7-11 1 3 1 6 0 8-2-7-8-12-19-12s-17 5-19 12c-1-2-1-5 0-8-3 1-7 5-7 11z" fill="url(#avHair)" />
        <path d="M34 52c0 8 3 14 6 16-2-6-2-12-1-16z" fill="url(#avHair)" />
        <path d="M86 52c0 8-3 14-6 16 2-6 2-12 1-16z" fill="url(#avHair)" />
        <circle cx="43" cy="38" r="4.5" fill="#fbbf24" />
        <circle cx="43" cy="38" r="2" fill="#fde68a" />
        <circle cx="51" cy="52" r={er} fill="url(#avEye)" />
        <circle cx="69" cy="52" r={er} fill="url(#avEye)" />
        <circle cx="52.3" cy="50.5" r="1.3" fill="#fff" />
        <circle cx="70.3" cy="50.5" r="1.3" fill="#fff" />
        <circle cx="49.9" cy="53.4" r="0.7" fill="#fff" opacity="0.6" />
        <circle cx="67.9" cy="53.4" r="0.7" fill="#fff" opacity="0.6" />
        <Blink x={45} y={47} w={12} h={9} color="#fbe0cc" />
        <Blink x={63} y={47} w={12} h={9} color="#fbe0cc" />
        <path d="M47 47 Q51 44 55 47" stroke="#5b3826" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M65 47 Q69 44 73 47" stroke="#5b3826" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <ellipse cx="45" cy="60" rx="4" ry="2.6" fill="#fda4af" opacity="0.7" />
        <ellipse cx="75" cy="60" rx="4" ry="2.6" fill="#fda4af" opacity="0.7" />
        {mouth != null ? <Mouth cx={60} cy={65} color="#b45309" open={mouth} />
          : talking ? <TalkMouth cx={60} cy={65} color="#b45309" />
          : mood === 'idle'
            ? <path d="M55 64 Q60 68 65 64" stroke="#b45309" strokeWidth="2" strokeLinecap="round" fill="none" />
            : <path d="M53 63 Q60 71 67 63" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        {mood === 'excited' && !talking && <text x="94" y="60" fontSize="14">👋</text>}
      </svg>
    </MoodWrap>
  )
}

/** پشمک — fluffy cat, phonics teacher. Soft, playful, sharp-eared. */
function Pashmak({ size = 120, mood = 'idle', talking, mouth, className }: CharProps) {
  const er = mood === 'excited' ? 4.5 : 3.5
  return (
    <MoodWrap mood={mood} talking={talking} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        <defs>
          <radialGradient id="pkHead" cx="40%" cy="30%" r="76%">
            <stop offset="0" stopColor="#f8fafc" /><stop offset="0.55" stopColor="#cbd5e1" /><stop offset="1" stopColor="#94a3b8" />
          </radialGradient>
          <radialGradient id="pkBody" cx="42%" cy="32%" r="78%">
            <stop offset="0" stopColor="#e2e8f0" /><stop offset="0.6" stopColor="#cbd5e1" /><stop offset="1" stopColor="#94a3b8" />
          </radialGradient>
          <linearGradient id="pkCream" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#eef2f7" />
          </linearGradient>
          <radialGradient id="pkEar" cx="50%" cy="25%" r="80%">
            <stop offset="0" stopColor="#f9a8d4" /><stop offset="1" stopColor="#ec4899" />
          </radialGradient>
          <radialGradient id="pkEye" cx="36%" cy="30%" r="75%">
            <stop offset="0" stopColor="#475569" /><stop offset="1" stopColor="#1e293b" />
          </radialGradient>
        </defs>
        <ellipse cx="58" cy="112" rx="30" ry="5" fill="#000" opacity="0.09" />
        <path d="M90 92c18-2 26-16 20-30-6 12-14 16-26 18z" fill="url(#pkBody)" />
        <path d="M104 68c-4 8-10 12-18 13l4 10c10-3 16-12 14-23z" fill="url(#pkCream)" opacity="0.9" />
        <ellipse cx="58" cy="86" rx="27" ry="21" fill="url(#pkBody)" />
        <ellipse cx="58" cy="92" rx="17" ry="12" fill="url(#pkCream)" />
        <circle cx="38" cy="54" r="7" fill="url(#pkHead)" />
        <circle cx="78" cy="54" r="7" fill="url(#pkHead)" />
        <path d="M37 32 L32 8 L52 20 Z" fill="url(#pkHead)" />
        <path d="M79 32 L84 8 L64 20 Z" fill="url(#pkHead)" />
        <path d="M40 28 L37 14 L49 22 Z" fill="url(#pkEar)" />
        <path d="M76 28 L79 14 L67 22 Z" fill="url(#pkEar)" />
        <circle cx="58" cy="46" r="25" fill="url(#pkHead)" />
        <path d="M42 34a25 25 0 0 1 14-8" stroke="#fff" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="58" cy="54" rx="13" ry="9" fill="url(#pkCream)" />
        <ellipse cx="43" cy="52" rx="4" ry="2.6" fill="#fb7185" opacity="0.3" />
        <ellipse cx="73" cy="52" rx="4" ry="2.6" fill="#fb7185" opacity="0.3" />
        <circle cx="48" cy="44" r={er} fill="url(#pkEye)" />
        <circle cx="68" cy="44" r={er} fill="url(#pkEye)" />
        <circle cx="49.5" cy="42.4" r="1.3" fill="#fff" />
        <circle cx="69.5" cy="42.4" r="1.3" fill="#fff" />
        <circle cx="46.8" cy="45.4" r="0.7" fill="#fff" opacity="0.6" />
        <circle cx="66.8" cy="45.4" r="0.7" fill="#fff" opacity="0.6" />
        <Blink x={42} y={39} w={12} h={9} color="#cbd5e1" />
        <Blink x={62} y={39} w={12} h={9} color="#cbd5e1" />
        <path d="M55 52 L61 52 L58 56 Z" fill="#f472b6" />
        <circle cx="56.4" cy="53" r="0.7" fill="#fff" opacity="0.6" />
        {mouth != null ? <Mouth cx={58} cy={61} color="#334155" open={mouth} />
          : talking ? <TalkMouth cx={58} cy={61} color="#334155" />
          : mood === 'idle'
            ? <path d="M54 60 Q58 62 62 60" stroke="#334155" strokeWidth="2" strokeLinecap="round" fill="none" />
            : <path d="M52 59 Q58 65 64 59" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        <path d="M36 52 L22 49 M36 56 L23 57" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M80 52 L94 49 M80 56 L93 57" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="46" cy="104" rx="7" ry="4.5" fill="url(#pkBody)" />
        <ellipse cx="70" cy="104" rx="7" ry="4.5" fill="url(#pkBody)" />
        {mood === 'excited' && !talking && <text x="90" y="26" fontSize="16">🎵</text>}
      </svg>
    </MoodWrap>
  )
}

/** لاکی — the tortoise, numbers teacher. Calm, patient, steady. */
function Laki({ size = 120, mood = 'idle', talking, mouth, className }: CharProps) {
  const er = mood === 'excited' ? 3.8 : 3
  return (
    <MoodWrap mood={mood} talking={talking} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        <defs>
          <radialGradient id="lkShell" cx="42%" cy="26%" r="82%">
            <stop offset="0" stopColor="#4ade80" /><stop offset="0.6" stopColor="#16a34a" /><stop offset="1" stopColor="#15803d" />
          </radialGradient>
          <radialGradient id="lkShellIn" cx="42%" cy="26%" r="80%">
            <stop offset="0" stopColor="#86efac" /><stop offset="1" stopColor="#4ade80" />
          </radialGradient>
          <radialGradient id="lkHead" cx="40%" cy="30%" r="76%">
            <stop offset="0" stopColor="#bbf7d0" /><stop offset="0.6" stopColor="#86efac" /><stop offset="1" stopColor="#4ade80" />
          </radialGradient>
          <radialGradient id="lkEye" cx="36%" cy="30%" r="75%">
            <stop offset="0" stopColor="#166534" /><stop offset="1" stopColor="#0b3d1f" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="106" rx="42" ry="5" fill="#000" opacity="0.1" />
        <ellipse cx="34" cy="92" rx="8" ry="6" fill="url(#lkHead)" />
        <ellipse cx="86" cy="92" rx="8" ry="6" fill="url(#lkHead)" />
        <ellipse cx="46" cy="98" rx="8" ry="6" fill="url(#lkHead)" />
        <ellipse cx="74" cy="98" rx="8" ry="6" fill="url(#lkHead)" />
        <path d="M24 84c0-24 16-40 36-40s36 16 36 40z" fill="url(#lkShell)" />
        <path d="M32 84c0-18 12-31 28-31s28 13 28 31z" fill="url(#lkShellIn)" />
        <path d="M60 53v31 M42 62l10 22 M78 62l-10 22" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M38 74h44" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M36 62c8-6 40-6 48 0" stroke="#fff" strokeOpacity="0.25" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="60" cy="34" r="16" fill="url(#lkHead)" />
        <path d="M49 26a16 16 0 0 1 10-5" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="54" cy="31" r={er} fill="url(#lkEye)" />
        <circle cx="66" cy="31" r={er} fill="url(#lkEye)" />
        <circle cx="55.1" cy="29.7" r="1.1" fill="#fff" />
        <circle cx="67.1" cy="29.7" r="1.1" fill="#fff" />
        <Blink x={49} y={27} w={10} h={8} color="#86efac" />
        <Blink x={61} y={27} w={10} h={8} color="#86efac" />
        {mouth != null ? <Mouth cx={60} cy={40} color="#14532d" open={mouth} />
          : talking ? <TalkMouth cx={60} cy={40} color="#14532d" />
          : mood === 'idle'
            ? <path d="M55 39 Q60 42 65 39" stroke="#14532d" strokeWidth="2" strokeLinecap="round" fill="none" />
            : <path d="M53 38 Q60 45 67 38" stroke="#14532d" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        <ellipse cx="48" cy="37" rx="3" ry="2" fill="#fb7185" opacity="0.5" />
        <ellipse cx="72" cy="37" rx="3" ry="2" fill="#fb7185" opacity="0.5" />
        {mood === 'excited' && !talking && <text x="88" y="30" fontSize="14" fontWeight="bold" fill="#166534">۱۲۳</text>}
      </svg>
    </MoodWrap>
  )
}

/** تندپا — the hare, colors teacher (fast & playful; the foil to Laki). */
function Tondpa({ size = 120, mood = 'idle', talking, mouth, className }: CharProps) {
  const er = mood === 'excited' ? 4.5 : 3.6
  return (
    <MoodWrap mood={mood} talking={talking} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        <defs>
          <radialGradient id="tpBody" cx="42%" cy="30%" r="78%">
            <stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor="#e2e8f0" /><stop offset="1" stopColor="#cbd5e1" />
          </radialGradient>
          <radialGradient id="tpEarIn" cx="50%" cy="25%" r="80%">
            <stop offset="0" stopColor="#fbcfe8" /><stop offset="1" stopColor="#f9a8d4" />
          </radialGradient>
          <radialGradient id="tpEye" cx="36%" cy="30%" r="75%">
            <stop offset="0" stopColor="#475569" /><stop offset="1" stopColor="#1e293b" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="113" rx="28" ry="5" fill="#000" opacity="0.09" />
        <ellipse cx="60" cy="92" rx="24" ry="20" fill="url(#tpBody)" />
        <ellipse cx="60" cy="96" rx="14" ry="12" fill="#fdfdff" />
        <ellipse cx="49" cy="108" rx="8" ry="5" fill="url(#tpBody)" />
        <ellipse cx="71" cy="108" rx="8" ry="5" fill="url(#tpBody)" />
        <ellipse cx="50" cy="24" rx="6.5" ry="20" fill="url(#tpBody)" />
        <ellipse cx="70" cy="24" rx="6.5" ry="20" fill="url(#tpBody)" />
        <ellipse cx="50" cy="26" rx="3" ry="14" fill="url(#tpEarIn)" />
        <ellipse cx="70" cy="26" rx="3" ry="14" fill="url(#tpEarIn)" />
        <circle cx="60" cy="52" r="24" fill="url(#tpBody)" />
        <circle cx="40" cy="58" r="8" fill="url(#tpBody)" />
        <circle cx="80" cy="58" r="8" fill="url(#tpBody)" />
        <path d="M44 40a24 24 0 0 1 14-8" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="51" cy="48" r={er} fill="url(#tpEye)" />
        <circle cx="69" cy="48" r={er} fill="url(#tpEye)" />
        <circle cx="52.4" cy="46.4" r="1.4" fill="#fff" />
        <circle cx="70.4" cy="46.4" r="1.4" fill="#fff" />
        <circle cx="49.8" cy="49.4" r="0.7" fill="#fff" opacity="0.6" />
        <circle cx="67.8" cy="49.4" r="0.7" fill="#fff" opacity="0.6" />
        <Blink x={45} y={43} w={12} h={9} color="#e2e8f0" />
        <Blink x={63} y={43} w={12} h={9} color="#e2e8f0" />
        <ellipse cx="44" cy="58" rx="4" ry="2.6" fill="#fb7185" opacity="0.6" />
        <ellipse cx="76" cy="58" rx="4" ry="2.6" fill="#fb7185" opacity="0.6" />
        <path d="M57 55 L63 55 L60 59 Z" fill="#f472b6" />
        <circle cx="58.4" cy="56" r="0.7" fill="#fff" opacity="0.6" />
        {mouth != null ? <Mouth cx={60} cy={64} color="#9d174d" open={mouth} />
          : talking ? <TalkMouth cx={60} cy={64} color="#9d174d" />
          : mood === 'idle'
            ? <path d="M56 62 Q60 65 64 62" stroke="#9d174d" strokeWidth="2" strokeLinecap="round" fill="none" />
            : <path d="M54 61 Q60 67 66 61" stroke="#9d174d" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        {mood === 'excited' && !talking && <text x="86" y="30" fontSize="15">🌈</text>}
      </svg>
    </MoodWrap>
  )
}

/** بومی — the owl, letters teacher. Wise, calm, wide-eyed. */
function Boomi({ size = 120, mood = 'idle', talking, mouth, className }: CharProps) {
  const er = mood === 'excited' ? 7 : 6
  return (
    <MoodWrap mood={mood} talking={talking} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        <defs>
          <radialGradient id="bmBody" cx="42%" cy="28%" r="80%">
            <stop offset="0" stopColor="#818cf8" /><stop offset="0.6" stopColor="#6366f1" /><stop offset="1" stopColor="#4338ca" />
          </radialGradient>
          <linearGradient id="bmBelly" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e0e7ff" /><stop offset="1" stopColor="#c7d2fe" />
          </linearGradient>
          <radialGradient id="bmDisc" cx="42%" cy="32%" r="72%">
            <stop offset="0" stopColor="#f8faff" /><stop offset="1" stopColor="#dbe4ff" />
          </radialGradient>
          <radialGradient id="bmEye" cx="38%" cy="30%" r="72%">
            <stop offset="0" stopColor="#334155" /><stop offset="1" stopColor="#0f172a" />
          </radialGradient>
          <linearGradient id="bmBeak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbbf24" /><stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity="0.1" />
        <path d="M50 106 l-4 6 M50 106 v7 M50 106 l4 6" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M70 106 l-4 6 M70 106 v7 M70 106 l4 6" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="60" cy="72" rx="30" ry="34" fill="url(#bmBody)" />
        <ellipse cx="60" cy="80" rx="19" ry="24" fill="url(#bmBelly)" />
        <path d="M30 64 q-7 18 5 31 q-10 -4 -12 -18 q-1 -9 7 -13z" fill="#4338ca" />
        <path d="M90 64 q7 18 -5 31 q10 -4 12 -18 q1 -9 -7 -13z" fill="#4338ca" />
        <path d="M42 50a30 30 0 0 1 16-14" stroke="#fff" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M36 40 L30 20 L48 34 Z" fill="url(#bmBody)" />
        <path d="M84 40 L90 20 L72 34 Z" fill="url(#bmBody)" />
        <circle cx="49" cy="50" r="15" fill="url(#bmDisc)" />
        <circle cx="71" cy="50" r="15" fill="url(#bmDisc)" />
        <circle cx="49" cy="50" r={er} fill="url(#bmEye)" />
        <circle cx="71" cy="50" r={er} fill="url(#bmEye)" />
        <circle cx="51.2" cy="47.6" r="2.2" fill="#fff" />
        <circle cx="73.2" cy="47.6" r="2.2" fill="#fff" />
        <circle cx="46.6" cy="52.4" r="1" fill="#fff" opacity="0.6" />
        <circle cx="68.6" cy="52.4" r="1" fill="#fff" opacity="0.6" />
        <Blink x={35} y={43} w={28} h={14} color="#dbe4ff" />
        <Blink x={57} y={43} w={28} h={14} color="#dbe4ff" />
        {mouth != null ? <Mouth cx={60} cy={62} color="#f59e0b" open={mouth} />
          : talking ? <TalkMouth cx={60} cy={62} color="#f59e0b" />
          : <path d="M55 58 L65 58 L60 67 Z" fill="url(#bmBeak)" />}
        {mood === 'excited' && !talking && <text x="84" y="28" fontSize="13" fontWeight="bold" fill="#c7d2fe">الف</text>}
      </svg>
    </MoodWrap>
  )
}

/** خرسی — the bear, feelings teacher. Warm, gentle, big-hearted. */
function Khersi({ size = 120, mood = 'idle', talking, mouth, className }: CharProps) {
  const er = mood === 'excited' ? 4 : 3.2
  return (
    <MoodWrap mood={mood} talking={talking} size={size} className={className}>
      <svg viewBox="0 0 120 120" fill="none" width={size} height={size}>
        <defs>
          <radialGradient id="khHead" cx="40%" cy="30%" r="76%">
            <stop offset="0" stopColor="#dcc39a" /><stop offset="0.55" stopColor="#c8a06a" /><stop offset="1" stopColor="#a9834f" />
          </radialGradient>
          <radialGradient id="khBody" cx="42%" cy="32%" r="78%">
            <stop offset="0" stopColor="#c39a6b" /><stop offset="0.6" stopColor="#b08968" /><stop offset="1" stopColor="#8f6a49" />
          </radialGradient>
          <radialGradient id="khMuzzle" cx="42%" cy="30%" r="74%">
            <stop offset="0" stopColor="#f4e6cf" /><stop offset="1" stopColor="#e7d3b8" />
          </radialGradient>
          <radialGradient id="khEar" cx="50%" cy="28%" r="80%">
            <stop offset="0" stopColor="#b0791f" /><stop offset="1" stopColor="#8a5f14" />
          </radialGradient>
          <radialGradient id="khEye" cx="36%" cy="30%" r="75%">
            <stop offset="0" stopColor="#4a2e1a" /><stop offset="1" stopColor="#2a1608" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="113" rx="30" ry="5" fill="#000" opacity="0.1" />
        <circle cx="42" cy="30" r="11" fill="url(#khEar)" />
        <circle cx="78" cy="30" r="11" fill="url(#khEar)" />
        <circle cx="42" cy="30" r="6" fill="#d4a373" />
        <circle cx="78" cy="30" r="6" fill="#d4a373" />
        <ellipse cx="60" cy="92" rx="26" ry="22" fill="url(#khBody)" />
        <ellipse cx="60" cy="96" rx="15" ry="14" fill="#d8c4a3" />
        <ellipse cx="46" cy="108" rx="8" ry="5" fill="url(#khBody)" />
        <ellipse cx="74" cy="108" rx="8" ry="5" fill="url(#khBody)" />
        <circle cx="60" cy="50" r="25" fill="url(#khHead)" />
        <path d="M44 34a25 25 0 0 1 14-8" stroke="#fff" strokeOpacity="0.32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="60" cy="60" rx="15" ry="11" fill="url(#khMuzzle)" />
        <circle cx="51" cy="46" r={er} fill="url(#khEye)" />
        <circle cx="69" cy="46" r={er} fill="url(#khEye)" />
        <circle cx="52.2" cy="44.6" r="1.2" fill="#fff" />
        <circle cx="70.2" cy="44.6" r="1.2" fill="#fff" />
        <circle cx="49.8" cy="47.2" r="0.7" fill="#fff" opacity="0.6" />
        <circle cx="67.8" cy="47.2" r="0.7" fill="#fff" opacity="0.6" />
        <Blink x={45} y={41} w={12} h={9} color="#c8a06a" />
        <Blink x={63} y={41} w={12} h={9} color="#c8a06a" />
        <ellipse cx="43" cy="56" rx="4.5" ry="3" fill="#f0a6a6" opacity="0.6" />
        <ellipse cx="77" cy="56" rx="4.5" ry="3" fill="#f0a6a6" opacity="0.6" />
        <ellipse cx="60" cy="56" rx="4.5" ry="3.2" fill="#3b2314" />
        <ellipse cx="58.6" cy="54.8" rx="1.1" ry="0.9" fill="#fff" opacity="0.5" />
        {mouth != null ? <Mouth cx={60} cy={66} color="#5b3a1e" open={mouth} />
          : talking ? <TalkMouth cx={60} cy={66} color="#5b3a1e" />
          : mood === 'idle'
            ? <path d="M55 64 Q60 68 65 64" stroke="#5b3a1e" strokeWidth="2" strokeLinecap="round" fill="none" />
            : <path d="M53 63 Q60 70 67 63" stroke="#5b3a1e" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
        {mood === 'excited' && !talking && <text x="86" y="30" fontSize="15">💛</text>}
      </svg>
    </MoodWrap>
  )
}

export default function CharacterAvatar({ slug, size = 120, mood = 'idle', talking, mouth, className }: Props) {
  if (slug === 'roozi') return <Roozi size={size} mood={mood} talking={talking} mouth={mouth} className={className} />
  if (slug === 'ava') return <Ava size={size} mood={mood} talking={talking} mouth={mouth} className={className} />
  if (slug === 'pashmak') return <Pashmak size={size} mood={mood} talking={talking} mouth={mouth} className={className} />
  if (slug === 'laki') return <Laki size={size} mood={mood} talking={talking} mouth={mouth} className={className} />
  if (slug === 'tondpa') return <Tondpa size={size} mood={mood} talking={talking} mouth={mouth} className={className} />
  if (slug === 'boomi') return <Boomi size={size} mood={mood} talking={talking} mouth={mouth} className={className} />
  if (slug === 'khersi') return <Khersi size={size} mood={mood} talking={talking} mouth={mouth} className={className} />
  // Simorgh (and unknown slugs) → the mascot artwork; talking = speech bob.
  const mascotMood = mood === 'excited' ? 'excited' : mood === 'happy' ? 'happy' : 'idle'
  return (
    <MoodWrap mood={mood} talking={talking} size={size} className={className}>
      <Mascot size={size} mood={talking ? 'idle' : mascotMood} />
    </MoodWrap>
  )
}
