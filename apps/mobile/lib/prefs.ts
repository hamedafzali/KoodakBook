import * as SecureStore from 'expo-secure-store'

// Family preferences (web keeps these in localStorage). SecureStore is async,
// so we hydrate an in-memory cache once at startup and let screens read it
// synchronously — the reader needs the translation language at fetch time.
const GOAL_KEY = 'koodakbook_daily_goal_min'
const LANG_KEY = 'koodakbook_translation_lang'
const TUTORIAL_KEY = 'koodakbook_seen_tutorial'

let dailyGoal = 10
let translationLang = 'en'
let tutorialSeen = false
let hydrated: Promise<void> | null = null
// True once the stored values are in the cache. A screen that shows a pref
// (parent settings) renders nothing until then instead of the defaults
// swapping to the stored values a frame later.
let ready = false

/** Load stored prefs into the cache. Idempotent; awaited by ensurePrefs(). */
export function ensurePrefs(): Promise<void> {
  if (!hydrated) {
    hydrated = (async () => {
      // Never rejects: a failed read keeps the defaults instead of leaving an
      // unhandled rejection at startup and every awaiting screen stuck.
      const [g, l, t] = await Promise.all([
        SecureStore.getItemAsync(GOAL_KEY),
        SecureStore.getItemAsync(LANG_KEY),
        SecureStore.getItemAsync(TUTORIAL_KEY),
      ]).catch(() => [null, null, null] as const)
      if (g) dailyGoal = parseInt(g, 10) || 10
      if (l) translationLang = l
      if (t === '1') tutorialSeen = true
      ready = true
    })()
  }
  return hydrated
}

/** Synchronous: have the stored prefs been read yet? */
export const prefsReady = () => ready
export const getDailyGoal = () => dailyGoal
export const getTranslationLang = () => translationLang
export const hasSeenTutorial = () => tutorialSeen

export function markTutorialSeen() {
  tutorialSeen = true
  void SecureStore.setItemAsync(TUTORIAL_KEY, '1')
}

export function setDailyGoal(v: number) {
  dailyGoal = v
  void SecureStore.setItemAsync(GOAL_KEY, String(v))
}

export function setTranslationLang(code: string) {
  translationLang = code
  void SecureStore.setItemAsync(LANG_KEY, code)
}
