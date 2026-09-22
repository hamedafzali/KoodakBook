import { router } from 'expo-router'

/**
 * A guarded twin of `router.back()`.
 *
 * Every plain `router.back()` in this app risks the exact crash Expo/React
 * Navigation logs as "The action 'GO_BACK' was not handled by any
 * navigator" — it fires whenever back is invoked with no screen behind the
 * current one in that stack. That's not a rare edge case here: Expo Router
 * deep-links straight to whatever path it's given (a QR code, a notification,
 * Fast Refresh remounting a screen at the top of its own stack), and several
 * screens in this app also call `router.back()` from a mount-time guard (e.g.
 * "if the character/story failed to load, leave") — which fires automatically,
 * with no user action and no guarantee anything precedes it. `router.back()`
 * has no built-in fallback; this does.
 *
 * `fallback` is the route this screen would sensibly land on if it turns out
 * to be the root of its own stack — the tab or hub it conceptually belongs
 * under (e.g. a math sub-game falls back to `/math`, not `/home`), not
 * always the same route for every screen.
 */
export function goBack(fallback: string): void {
  if (router.canGoBack()) router.back()
  else router.replace(fallback)
}
