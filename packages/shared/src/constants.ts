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
] as const

export const BADGE_DEFINITIONS = {
  first_lesson: { title: 'اولین قدم!',     description: 'اولین درست را تموم کردی' },
  first_story:  { title: 'داستان‌خوان!',   description: 'اولین داستان فارسی را خواندی' },
  words_10:     { title: 'کلمه‌جمع‌کن!',   description: '۱۰ کلمه فارسی یاد گرفتی' },
  words_25:     { title: 'استاد کلمات!',   description: '۲۵ کلمه فارسی یاد گرفتی' },
  stories_3:    { title: 'کتاب‌دوست!',     description: '۳ داستان فارسی خواندی' },
  lessons_5:    { title: 'شاگرد زرنگ!',    description: '۵ درس تموم کردی' },
  streak_7:     { title: '۷ روز قوی!',     description: '۷ روز پشت سر هم تمرین کردی' },
  all_alphabet: { title: 'قهرمان الفبا!',  description: 'همه‌ی حروف الفبا را یاد گرفتی' },
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
