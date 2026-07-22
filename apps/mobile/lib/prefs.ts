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

/** Load stored prefs into the cache. Idempotent; awaited by ensurePrefs(). */
export function ensurePrefs(): Promise<void> {
  if (!hydrated) {
    hydrated = (async () => {
      const [g, l, t] = await Promise.all([
        SecureStore.getItemAsync(GOAL_KEY),
        SecureStore.getItemAsync(LANG_KEY),
        SecureStore.getItemAsync(TUTORIAL_KEY),
      ])
      if (g) dailyGoal = parseInt(g, 10) || 10
      if (l) translationLang = l
      if (t === '1') tutorialSeen = true
    })()
  }
  return hydrated
}

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
