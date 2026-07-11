/* Family translation-language preference (set by the parent in settings).
 * Device-local, applied on the child's story screen. 'none' hides translation.
 * Migrates the old boolean key so existing setups keep working. */

const KEY = 'koodakbook_translation_lang'
const OLD_BOOL = 'koodakbook_show_translation'

export function getTranslationLang(): string {
  if (typeof window === 'undefined') return 'en'
  const v = localStorage.getItem(KEY)
  if (v) return v
  const old = localStorage.getItem(OLD_BOOL)   // '0' meant off, anything else on
  return old === '0' ? 'none' : 'en'
}

export function setTranslationLang(code: string): void {
  try { localStorage.setItem(KEY, code) } catch { /* ignore */ }
}
