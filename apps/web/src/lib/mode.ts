import { lockParent } from './auth'

/**
 * Which surface the device is showing. The *session* (JWT) keeps the device
 * logged in; `mode` decides where an already-logged-in device lands. Child mode
 * persists across refresh/relaunch so a child never sees a login or PIN — the
 * PIN only guards *switching up* to parent mode.
 */
const MODE_KEY = 'koodakbook_mode'
export type Mode = 'child' | 'parent'

export function getMode(): Mode {
  if (typeof window === 'undefined') return 'parent'
  return localStorage.getItem(MODE_KEY) === 'child' ? 'child' : 'parent'
}

export function setMode(m: Mode) {
  try { localStorage.setItem(MODE_KEY, m) } catch { /* ignore */ }
}

/** Parent hands the device to the child: remember child mode and re-lock the
 *  parent area so coming back requires the PIN again. */
export function enterChildMode() {
  setMode('child')
  lockParent()
}
