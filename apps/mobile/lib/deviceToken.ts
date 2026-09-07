import * as SecureStore from 'expo-secure-store'

/**
 * Per-child device-binding credential (mig 059 / picture-password login).
 * Mirrors web's lib/deviceToken.ts, but keyed as one SecureStore entry per
 * child (SecureStore has no natural "object" store) rather than one
 * localStorage blob. Opaque to the client — only ever sent back to
 * /api/auth/child-login/verify-picture so the server can recognize "this
 * device already proved it belongs to this child" and skip the parent-PIN
 * step.
 */
function key(childId: string) {
  return `koodakbook_device_token_${childId}`
}

export function getDeviceToken(childId: string): Promise<string | null> {
  return SecureStore.getItemAsync(key(childId))
}

export function setDeviceToken(childId: string, token: string): Promise<void> {
  return SecureStore.setItemAsync(key(childId), token)
}
