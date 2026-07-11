/* ── Translation languages ──────────────────────────────────
 * The parent chooses ONE family language shown under the Persian story text
 * (or «خاموش» for none). English ships pre-translated; the rest are filled on
 * demand by the AI provider and cached per page (mig 040). */

export interface TranslationLang {
  code: string      // ISO-ish key stored in story_pages.translations
  label: string     // Persian label for the parent picker
  english: string   // English name — handed to the AI translate prompt
  flag: string
}

export const TRANSLATION_LANGS: TranslationLang[] = [
  { code: 'en', label: 'انگلیسی', english: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'آلمانی',  english: 'German',  flag: '🇩🇪' },
  { code: 'nl', label: 'هلندی',   english: 'Dutch',   flag: '🇳🇱' },
  { code: 'sv', label: 'سوئدی',   english: 'Swedish', flag: '🇸🇪' },
  { code: 'fr', label: 'فرانسوی', english: 'French',  flag: '🇫🇷' },
  { code: 'es', label: 'اسپانیایی', english: 'Spanish', flag: '🇪🇸' },
  { code: 'tr', label: 'ترکی',    english: 'Turkish', flag: '🇹🇷' },
  { code: 'ar', label: 'عربی',    english: 'Arabic',  flag: '🇸🇦' },
]

export function isTranslationLang(code: unknown): boolean {
  return typeof code === 'string' && TRANSLATION_LANGS.some(l => l.code === code)
}

export function langEnglishName(code: string): string {
  return TRANSLATION_LANGS.find(l => l.code === code)?.english ?? 'English'
}
