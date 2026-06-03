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
  first_lesson:    { title: 'اولین قدم!',       description: 'اولین درست را تموم کردی',           hint: 'یک درس کامل کن', effort: false },
  first_story:     { title: 'داستان‌خوان!',     description: 'اولین داستان فارسی را خواندی',      hint: 'یک داستان بخوان', effort: false },
  words_10:        { title: 'کلمه‌جمع‌کن!',     description: '۱۰ کلمه فارسی یاد گرفتی',          hint: '۱۰ کلمه یاد بگیر', effort: false },
  words_25:        { title: 'استاد کلمات!',     description: '۲۵ کلمه فارسی یاد گرفتی',          hint: '۲۵ کلمه یاد بگیر', effort: false },
  stories_3:       { title: 'کتاب‌دوست!',       description: '۳ داستان فارسی خواندی',             hint: '۳ داستان بخوان', effort: false },
  lessons_5:       { title: 'شاگرد زرنگ!',      description: '۵ درس تموم کردی',                  hint: '۵ درس کامل کن', effort: false },
  streak_7:        { title: '۷ روز قوی!',       description: '۷ روز پشت سر هم تمرین کردی',       hint: '۷ روز متوالی تمرین کن', effort: false },
  all_alphabet:    { title: 'قهرمان الفبا!',    description: 'همه‌ی حروف الفبا را یاد گرفتی',    hint: 'همه درس‌های الفبا را کامل کن', effort: false },
  tried_today:     { title: 'امروز تلاش کردی!', description: 'امروز وارد اپ شدی و تمرین کردی',   hint: 'هر روز وارد اپ بشو', effort: true },
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

/* Activity gradient classes — one source of truth used by home, lesson list, story list */
export const ACTIVITY_GRADIENTS = [
  'from-red-400 to-orange-400',
  'from-blue-400 to-cyan-400',
  'from-green-400 to-emerald-400',
  'from-purple-400 to-pink-400',
  'from-yellow-400 to-amber-400',
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
