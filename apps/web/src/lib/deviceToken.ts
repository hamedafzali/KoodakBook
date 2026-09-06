/**
 * Per-child device-binding credential (mig 059 / picture-password login).
 * Opaque to the client — it's only ever sent back to
 * /api/auth/child-login/verify-picture so the server can recognize "this
 * device already proved it belongs to this child" and skip the parent-PIN
 * step. A family tablet can hold one of these per sibling, so this is keyed
 * by child_id rather than a single value.
 */
const KEY = 'koodakbook_device_tokens'

function readAll(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

export function getDeviceToken(childId: string): string | null {
  return readAll()[childId] ?? null
}

export function setDeviceToken(childId: string, token: string) {
  if (typeof window === 'undefined') return
  const all = readAll()
  all[childId] = token
  localStorage.setItem(KEY, JSON.stringify(all))
}
