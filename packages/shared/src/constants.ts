import type { Strand } from './types'

/**
 * Plan entitlement catalog (single source of truth for what plans can unlock).
 * The admin Plans editor renders this as a friendly form — toggles for flags,
 * number inputs for limits — so admins never type raw feature keys. The app's
 * entitlement checks should read against these same keys.
 */
export interface FeatureDef {
  key: string
  label: string
  description: string
  type: 'boolean' | 'number'
  default: string
}
export const PLAN_FEATURES: FeatureDef[] = [
  { key: 'max_children',       label: 'حداکثر تعداد کودک',            description: 'چند پروفایل کودک می‌توان در این پلن ساخت', type: 'number',  default: '1' },
  { key: 'full_story_library', label: 'کتابخانه‌ی کامل داستان‌ها',    description: 'دسترسی به همه‌ی داستان‌ها (نه فقط چند داستان رایگان اول)', type: 'boolean', default: 'false' },
  { key: 'ai_stories',         label: 'داستان‌های شخصی‌سازی‌شده (AI)', description: 'ساخت داستان با نام و علایق خود کودک', type: 'boolean', default: 'false' },
  { key: 'co_read',            label: 'هم‌خوانی والد و کودک',          description: 'حالت خواندن مشترک با متن بزرگ‌تر', type: 'boolean', default: 'false' },
  { key: 'record_voice',       label: 'ضبط صدای والد',                description: 'والد می‌تواند صدای خودش را روی داستان ضبط کند', type: 'boolean', default: 'false' },
]
export const featureLabel = (key: string) => PLAN_FEATURES.find(f => f.key === key)?.label ?? key

/** A child's measured level per learning strand (mig-020). */
export type StrandLevels = Record<Strand, number>

/** Permissive default (nothing locked) used before placement data loads. */
export const ALL_UNLOCKED: StrandLevels = { P: 9, D: 9, V: 9, F: 9, C: 9 }

/** The strand a lesson primarily trains (maps lesson.type → strand). */
export function lessonStrand(type: string): Strand {
  switch (type) {
    case 'vocabulary': return 'V'
    case 'phonics':    return 'D'  // short vowels — decoding bridge
    case 'alphabet':   return 'D'
    default:           return 'V'
  }
}

/**
 * Content unlock rules driven by placement + promotion (mig-020 / §11.1).
 * A strand at level L opens content up to stage L+1 — your "growth edge" — so a
 * heritage child at D=1 (can't read) immediately gets the alphabet (stage 2,
 * the entry to decoding) rather than having it locked. Stages further out stay
 * gated. Stories unlock a stage earlier still (audio-supported, input-rich).
 */
export function isLessonUnlocked(lesson: { type: string; stage: number }, lv: StrandLevels): boolean {
  return lv[lessonStrand(lesson.type)] >= lesson.stage - 1
}
export function isStoryUnlocked(story: { stage: number }, lv: StrandLevels): boolean {
  return Math.max(lv.F, lv.C) >= story.stage - 2
}

export const CURRICULUM_STAGES = {
  1: { label: 'Phonemic Awareness', age: '3–5', description: 'Audio and visuals, no reading yet' },
  2: { label: 'Script Introduction', age: '5–7', description: 'Alphabet and letter recognition' },
  3: { label: 'Simple Stories', age: '6–9', description: 'Short bilingual stories with audio' },
  4: { label: 'Reading for Meaning', age: '8–12', description: 'Longer stories with rich vocabulary' },
} as const

export const WORD_CATEGORIES = [
  'animals',
  'colors',
  'family',
  'food',
  'body',
  'nature',
  'objects',
  'numbers',
  'shapes',
  'feelings',
  'actions',
  'greetings',
  'clothes',
  'transportation',
  'weather',
  'school',
  'opposites',
  'questions',
  'prepositions',
] as const

export const BADGE_KEYS = [
  'first_lesson',
  'first_story',
  'words_10',
  'words_25',
  'stories_3',
  'lessons_5',
  'streak_7',
  'all_alphabet',
  'tried_today',
  'practiced_again',
  'streak_3',
] as const

export const BADGE_DEFINITIONS = {
  first_lesson:    { title: 'اولین قدم!',       description: 'اولین درست را تمام کردی',           hint: 'یک درس کامل کن', effort: false },
  first_story:     { title: 'داستان‌خوان!',     description: 'اولین داستان فارسی را خواندی',      hint: 'یک داستان بخوان', effort: false },
  words_10:        { title: 'کلمه‌جمع‌کن!',     description: '۱۰ کلمه فارسی یاد گرفتی',          hint: '۱۰ کلمه یاد بگیر', effort: false },
  words_25:        { title: 'استاد کلمات!',     description: '۲۵ کلمه فارسی یاد گرفتی',          hint: '۲۵ کلمه یاد بگیر', effort: false },
  stories_3:       { title: 'کتاب‌دوست!',       description: '۳ داستان فارسی خواندی',             hint: '۳ داستان بخوان', effort: false },
  lessons_5:       { title: 'شاگرد زرنگ!',      description: '۵ درس تمام کردی',                  hint: '۵ درس کامل کن', effort: false },
  streak_7:        { title: '۷ روز قوی!',       description: '۷ روز پشت سر هم تمرین کردی',       hint: '۷ روز متوالی تمرین کن', effort: false },
  all_alphabet:    { title: 'قهرمان الفبا!',    description: 'همه‌ی حروف الفبا را یاد گرفتی',    hint: 'همه درس‌های الفبا را کامل کن', effort: false },
  tried_today:     { title: 'امروز تلاش کردی!', description: 'امروز وارد برنامه شدی و تمرین کردی', hint: 'هر روز وارد برنامه بشو', effort: true },
  practiced_again: { title: 'دوباره تمرین!',    description: 'یک کلمه را دوباره مرور کردی',       hint: 'یک کلمه را مرور کن', effort: true },
  streak_3:        { title: '۳ روز پشت سرهم!',  description: '۳ روز متوالی تمرین کردی',           hint: '۳ روز متوالی تمرین کن', effort: true },
} as const

export const LETTER_GROUPS: Record<number, string[]> = {
  1: ['ا', 'آ'],
  2: ['ب', 'پ', 'ت', 'ث'],
  3: ['ج', 'چ', 'ح', 'خ'],
  4: ['د', 'ذ', 'ر', 'ز', 'ژ'],
  5: ['س', 'ش'],
  6: ['ص', 'ض', 'ط', 'ظ'],
  7: ['ع', 'غ', 'ف', 'ق'],
  8: ['ک', 'گ', 'ل', 'م', 'ن', 'و', 'ه', 'ی'],
}

/* Activity gradient classes — one source of truth used by home, lesson list, story list.
 * Tiers kept at -500/-600 so white text on top clears WCAG large-text contrast (the
 * old -400 tiers, esp. yellow, failed badly). */
export const ACTIVITY_GRADIENTS = [
  'from-red-500 to-orange-500',
  'from-blue-500 to-cyan-600',
  'from-green-500 to-emerald-600',
  'from-purple-500 to-pink-600',
  'from-amber-500 to-orange-600',
] as const

export const LESSON_TYPE_EMOJI: Record<string, string> = {
  vocabulary: '📚',
  alphabet:   '🔤',
  phonics:    '🎵',
}

export const LESSON_TYPE_LABEL: Record<string, string> = {
  vocabulary: 'واژگان',
  alphabet:   'الفبا',
  phonics:    'آواشناسی',
}

export const BADGE_EMOJI: Record<string, string> = {
  first_lesson:    '📚',
  first_story:     '📖',
  words_10:        '⭐',
  words_25:        '🌟',
  stories_3:       '📚',
  lessons_5:       '🎓',
  streak_7:        '🔥',
  all_alphabet:    '🔤',
  tried_today:     '💪',
  practiced_again: '🔄',
  streak_3:        '✨',
}

/* XP values per action */
export const XP_VALUES = {
  lesson_item_viewed:   1,
  story_page_read:      2,
  quiz_correct:         5,
  quiz_incorrect:       1,
  lesson_completed:    20,
  story_completed:     15,
  streak_day_bonus:    10,
} as const

/* Level thresholds and Persian names */
export const XP_LEVELS = [
  { min: 0,   label: 'شاگرد',      labelEn: 'Student'    },
  { min: 50,  label: 'دانش‌آموز',  labelEn: 'Scholar'    },
  { min: 150, label: 'هنرجو',       labelEn: 'Apprentice' },
  { min: 350, label: 'استاد',       labelEn: 'Master'     },
] as const

export interface XpLevel {
  level: number       // 1-based index into XP_LEVELS
  label: string
  labelEn: string
  xp: number          // total xp
  intoLevel: number   // xp earned within the current level
  span: number        // xp needed to span the current level (Infinity-safe number)
  toNext: number      // xp remaining to next level (0 if max)
  pct: number         // 0-100 progress within current level
  isMax: boolean
}

/** Resolve a total XP value into level metadata for display. */
export function resolveLevel(xp: number): XpLevel {
  let idx = 0
  for (let i = 0; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i].min) idx = i
  }
  const cur = XP_LEVELS[idx]
  const next = XP_LEVELS[idx + 1]
  const isMax = !next
  const intoLevel = xp - cur.min
  const span = isMax ? Math.max(intoLevel, 1) : next.min - cur.min
  const toNext = isMax ? 0 : next.min - xp
  const pct = isMax ? 100 : Math.min(100, Math.round((intoLevel / span) * 100))
  return { level: idx + 1, label: cur.label, labelEn: cur.labelEn, xp, intoLevel, span, toNext, pct, isMax }
}

/**
 * Word → emoji map, keyed by the English word value.
 * Used as a visual stand-in until real illustrations are produced so that
 * pre-readers always see a picture and the image-based quiz modes work.
 */
export const WORD_EMOJI: Record<string, string> = {
  // Animals
  cat: '🐱', dog: '🐶', horse: '🐴', cow: '🐄', chicken: '🐔', fish: '🐟',
  rabbit: '🐰', elephant: '🐘', duck: '🦆', frog: '🐸', bear: '🐻',
  camel: '🐫', monkey: '🐵', peacock: '🦚', turtle: '🐢', bee: '🐝',
  lion: '🦁', bird: '🐦',
  // Colors (color swatches)
  red: '🟥', blue: '🟦', green: '🟩', yellow: '🟨', white: '⬜', black: '⬛',
  orange: '🟧', pink: '🌸', purple: '🟪', brown: '🟫', grey: '◻️', golden: '🟡',
  // Family
  mom: '👩', dad: '👨', sister: '👧', brother: '👦',
  grandma: '👵', grandmother: '👵', grandpa: '👴', grandfather: '👴',
  uncle: '🧔', aunt: '👩', cousin: '🧒', baby: '👶',
  // Body
  head: '🗣️', eye: '👁️', mouth: '👄', hand: '✋', foot: '🦶', ear: '👂',
  hair: '💇', eyebrow: '🤨', belly: '🤰', knee: '🦵', finger: '👆', neck: '🧣',
  nose: '👃',
  // Food
  bread: '🍞', water: '💧', milk: '🥛', apple: '🍎', rice: '🍚', egg: '🥚',
  banana: '🍌', grapes: '🍇', watermelon: '🍉', carrot: '🥕', yogurt: '🥣',
  // Numbers
  one: '1️⃣', two: '2️⃣', three: '3️⃣', four: '4️⃣', five: '5️⃣',
  six: '6️⃣', seven: '7️⃣', eight: '8️⃣', nine: '9️⃣', ten: '🔟',
  // Shapes
  circle: '⭕', square: '🟦', triangle: '🔺', star: '⭐', heart: '❤️', rectangle: '🟧',
  // Nature
  tree: '🌳', flower: '🌸', sun: '☀️', cloud: '☁️', rain: '🌧️', moon: '🌙',
  snow: '❄️', sea: '🌊', mountain: '⛰️', river: '🏞️', wind: '💨', sky: '🌤️',
  // Objects
  book: '📚', pen: '🖊️', table: '🪑', chair: '🪑', door: '🚪', window: '🪟',
  bag: '🎒', clock: '🕐', car: '🚗', ball: '⚽', doll: '🪆', bed: '🛏️',
  // Feelings
  happy: '😊', sad: '😢', tired: '😴', hungry: '🍽️', scared: '😨',
  laugh: '😄', cry: '😭', angry: '😠',
  // Actions
  eat: '🍴', sleep: '😴', run: '🏃', play: '🧸', read: '📖', write: '✏️',
  go: '🚶', come: '👋', sit: '🪑', stand: '🧍',
  // Greetings
  hello: '👋', goodbye: '👋', 'thank you': '🙏', yes: '✅', no: '❌', please: '🙇',
}

export function wordEmoji(english: string | null | undefined): string | null {
  if (!english) return null
  return WORD_EMOJI[english.toLowerCase().trim()] ?? null
}

/* ── Entitlements ──────────────────────────────────────────── */
export type Plan = 'free' | 'premium'

/** Whether an account currently has active premium access. */
export function isPremiumActive(
  plan: string | null | undefined,
  expiresAt?: string | null,
): boolean {
  if (plan !== 'premium') return false
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() > Date.now()
}

/* ── Phonics: short vowels (the bridge from alphabet to reading) ────────────
 * Persian short vowels are diacritics, not letters. Kids learn zabar/zir/pish
 * to turn a consonant into a syllable (بَ=ba, بِ=be, بُ=bo) — the step that
 * makes 2–3 letter words readable. Audio is pre-generated to /audio/phonics/. */
export interface ShortVowel {
  key: 'zabar' | 'zir' | 'pish'
  mark: string          // combining diacritic
  namePersian: string   // child-facing name
  latin: 'a' | 'e' | 'o'
  color: string         // tailwind gradient classes for its tiles
}

export const SHORT_VOWELS: ShortVowel[] = [
  { key: 'zabar', mark: 'َ', namePersian: 'زبر', latin: 'a', color: 'from-red-500 to-orange-500' },
  { key: 'zir',   mark: 'ِ', namePersian: 'زیر', latin: 'e', color: 'from-blue-500 to-cyan-600' },
  { key: 'pish',  mark: 'ُ', namePersian: 'پیش', latin: 'o', color: 'from-green-500 to-emerald-600' },
]

/** Starter consonants — simple shapes/sounds, with their latin for slugs. */
export const PHONICS_CONSONANTS: { ch: string; latin: string }[] = [
  { ch: 'ب', latin: 'b' },
  { ch: 'پ', latin: 'p' },
  { ch: 'ت', latin: 't' },
  { ch: 'د', latin: 'd' },
  { ch: 'ر', latin: 'r' },
  { ch: 'س', latin: 's' },
  { ch: 'م', latin: 'm' },
  { ch: 'ن', latin: 'n' },
]

export interface Syllable {
  text: string          // consonant + vowel mark, e.g. 'بَ'
  latin: string         // 'ba'
  slug: string          // filename stem, == latin
  consonant: string
  vowelKey: ShortVowel['key']
}

/** All starter syllables (consonant × short vowel). Source of truth for the
 * UI and for scripts/generate_audio.py (keep slugs in sync). */
export function phonicsSyllables(): Syllable[] {
  const out: Syllable[] = []
  for (const c of PHONICS_CONSONANTS) {
    for (const v of SHORT_VOWELS) {
      const latin = c.latin + v.latin
      out.push({ text: c.ch + v.mark, latin, slug: latin, consonant: c.ch, vowelKey: v.key })
    }
  }
  return out
}

/** Clip for a phonics syllable — regenerated by the admin TTS tool into the
 *  uploads volume (falls back to browser TTS if the file is missing). */
export function phonicsAudioUrl(slug: string): string {
  return `/uploads/phonics/${slug}.wav`
}

/**
 * Persian-first lesson titles, keyed by the English title used in the seed.
 * The child UI shows Persian; English remains as a secondary label.
 */
export const LESSON_TITLE_FA: Record<string, string> = {
  'Animals':          'حیوانات',
  'Colors':           'رنگ‌ها',
  'Family':           'خانواده',
  'Body Parts':       'بدن',
  'Food & Drink':     'خوراکی‌ها',
  'Numbers':          'عددها',
  'Shapes':           'شکل‌ها',
  'Nature':           'طبیعت',
  'At Home':          'در خانه',
  'Feelings':         'احساس‌ها',
  'Actions':          'کارها',
  'Greetings':        'سلام و احوال‌پرسی',
  'Alphabet Group 1': 'الفبا - گروه ۱',
  'Alphabet Group 2': 'الفبا - گروه ۲',
  'Alphabet Group 3': 'الفبا - گروه ۳',
  'Alphabet Group 4': 'الفبا - گروه ۴',
  'Alphabet Group 5': 'الفبا - گروه ۵',
  'Alphabet Group 6': 'الفبا - گروه ۶',
  'Alphabet Group 7': 'الفبا - گروه ۷',
  'Alphabet Group 8': 'الفبا - گروه ۸',
}

export function lessonTitleFa(title: string): string {
  return LESSON_TITLE_FA[title] ?? title
}
