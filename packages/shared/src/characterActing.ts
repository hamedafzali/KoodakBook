/* ── Character acting: turn a SENTENCE into a timed performance ──────────────
 *
 * The problem this solves: `talking` used to be a boolean that ran a generic
 * mouth-flap loop with no relation to the words — the acting didn't match the
 * sentence. Here a line's text (+ its emotion) becomes a `Performance`: a body
 * `mood` plus a timeline of mouth-openness frames (visemes) that actually track
 * the Persian letters, with pauses at punctuation.
 *
 * Dependency-free plain TS (like animation.ts) so web, admin AND the backend/
 * mobile builds can all share it. The React side just reads the frames over a
 * rAF clock; pass `totalMs` (a clip's real duration) and the whole track scales
 * to lock lip-sync to the audio.
 */

// The body-acting states the CharacterAvatar rig understands (mood + talking).
export type ActingMood = 'idle' | 'happy' | 'excited' | 'encouraging' | 'thinking'

export interface PerfFrame {
  /** milliseconds from performance start */
  t: number
  /** mouth/beak openness 0..1 (a viseme target); omit to leave unchanged */
  mouth?: number
  /** switch the body mood at this beat; omit to leave unchanged */
  mood?: ActingMood
}

export interface Performance {
  emotion: ActingMood
  /** total length incl. the trailing settle, ms */
  duration: number
  frames: PerfFrame[]
}

// ── Persian viseme table: letter → mouth openness ───────────
// Vowels/open sounds drop the jaw; و rounds; ی widens; ب پ م close it.
const OPEN: Record<string, number> = {
  'ا': 0.9, 'آ': 0.95, 'أ': 0.9, 'إ': 0.9, 'ه': 0.7, 'ع': 0.72, 'ح': 0.66,
  'خ': 0.58, 'ق': 0.6, 'غ': 0.58, 'د': 0.48, 'ت': 0.45, 'ط': 0.5, 'ک': 0.5,
  'گ': 0.5, 'ر': 0.5, 'ز': 0.42, 'س': 0.4, 'ص': 0.42, 'ش': 0.4, 'ج': 0.5,
  'چ': 0.5, 'ن': 0.42, 'ل': 0.46, 'َ': 0.7, // zabar (fatha)
}
const ROUND: Record<string, number> = { 'و': 0.55, 'ؤ': 0.55, 'ُ': 0.5 } // pish (damma)
const WIDE: Record<string, number> = { 'ی': 0.5, 'ي': 0.5, 'ئ': 0.5, 'ِ': 0.45 } // zir (kasra)
const CLOSED: Record<string, number> = { 'ب': 0.05, 'پ': 0.05, 'م': 0.05, 'ف': 0.16, 'و': 0.55 }
// Combining marks / joiners that carry no mouth shape of their own:
// ZWNJ, RLM, LRM, tatweel, shadda, sukun, and the three tanwin.
const SKIP = new Set(['‌', '‏', '‎', 'ـ', 'ّ', 'ْ', 'ً', 'ٌ', 'ٍ'])

/** Mouth openness for a single character, or null if it isn't a speech sound. */
export function visemeOpen(ch: string): number | null {
  if (SKIP.has(ch)) return null
  if (ch in CLOSED) return CLOSED[ch]
  if (ch in OPEN) return OPEN[ch]
  if (ch in ROUND) return ROUND[ch]
  if (ch in WIDE) return WIDE[ch]
  // Any other Persian letter → a mid opening, varied deterministically so the
  // flap stays lively but the track is reproducible (no Math.random).
  if (/[ء-ۿ]/.test(ch)) return 0.36 + (ch.charCodeAt(0) % 3) * 0.11
  return null
}

/** Classify a free-text line into a body mood (used when no emotion is given).
 *  Order matters: a corrective line often ends in «!» («دوباره امتحان کن!»), so
 *  the encouraging cue must win over the excited exclamation-mark cue. */
export function classifyEmotion(text: string): ActingMood {
  if (/اشتباه|اوه|دوباره|اشکال|نگران|نشد|سعی|امتحان|نبود/.test(text)) return 'encouraging'
  if (/[!❗]|آفرین|عالی|براوو|هورا|آفري|واو|هورااا/.test(text)) return 'excited'
  if (/[؟?]|فکر|شاید|هوم|بذار|ببینم|یعنی/.test(text)) return 'thinking'
  return 'happy'
}

/** Map a stored line emotion (or any string) onto a rig mood. */
export function moodForEmotion(emotion?: string | null): ActingMood {
  switch (emotion) {
    case 'excited': return 'excited'
    case 'encouraging': return 'encouraging'
    case 'thinking': return 'thinking'
    case 'idle': return 'idle'
    case 'happy': return 'happy'
    default: return 'happy'
  }
}

const LEAD_MS = 120      // beat before the first sound
const STEP_MS = 108      // per-viseme cadence (unscaled)
const COMMA_MS = 190
const STOP_MS = 300
const SETTLE_MS = 520    // hold the mood after the mouth closes

export interface BuildOpts {
  /** Real audio duration (ms). When set, the viseme timeline is scaled so the
   *  last spoken sound lands with the clip — locking lip-sync to the voice. */
  totalMs?: number
}

/**
 * Build a performance for a line. `emotion` (a line's stored emotion column)
 * wins for the body mood; without it we classify the text.
 */
export function buildPerformance(text: string, emotion?: string | null, opts: BuildOpts = {}): Performance {
  const mood: ActingMood = emotion ? moodForEmotion(emotion) : classifyEmotion(text)
  const raw: { t: number; mouth: number }[] = []
  let t = LEAD_MS
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') { t += 70; continue }
    if (ch === '،' || ch === ',') { raw.push({ t, mouth: 0.05 }); t += COMMA_MS; continue }
    if ('.؟?!؛;:…'.includes(ch)) { raw.push({ t, mouth: 0 }); t += STOP_MS; continue }
    const v = visemeOpen(ch)
    if (v == null) continue
    raw.push({ t, mouth: v })
    t += STEP_MS
  }
  const speechEnd = Math.max(t, LEAD_MS + STEP_MS)
  // Scale to the real clip length when we have it.
  const scale = opts.totalMs && speechEnd > 0 ? opts.totalMs / speechEnd : 1

  const frames: PerfFrame[] = [{ t: 0, mood, mouth: 0 }]
  for (const r of raw) frames.push({ t: Math.round(r.t * scale), mouth: +r.mouth.toFixed(2) })
  const end = Math.round(speechEnd * scale)
  frames.push({ t: end + 40, mouth: 0 })
  const duration = end + SETTLE_MS
  return { emotion: mood, duration, frames }
}
