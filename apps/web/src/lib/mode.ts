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

const PICK_KEY = 'koodakbook_child_pick'

/** Parent hands the device to the child: remember child mode and re-lock the
 *  parent area so coming back requires the PIN again. Pass { pick: true } when a
 *  *parent* is switching over, so child mode asks "who's playing?" if there are
 *  several kids (not after an assessment, which returns to the same child). */
export function enterChildMode(opts?: { pick?: boolean }) {
  setMode('child')
  lockParent()
  try {
    if (opts?.pick) sessionStorage.setItem(PICK_KEY, '1')
    else sessionStorage.removeItem(PICK_KEY)
  } catch { /* ignore */ }
}

/** Read-and-clear the "ask who's playing" flag (true only right after a parent
 *  switched to child mode). */
export function consumeChildPick(): boolean {
  try {
    const v = sessionStorage.getItem(PICK_KEY) === '1'
    sessionStorage.removeItem(PICK_KEY)
    return v
  } catch { return false }
}
