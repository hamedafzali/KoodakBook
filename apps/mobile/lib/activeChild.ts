import * as SecureStore from 'expo-secure-store'

// Mirrors web's lib/activeChild.ts (localStorage) — which child is using the
// device right now. Kept in SecureStore alongside the token so a logout can
// wipe both.
const KEY = 'koodakbook_active_child'

export function getActiveChildId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY)
}

export function setActiveChildId(id: string): Promise<void> {
  return SecureStore.setItemAsync(KEY, id)
}

export function clearActiveChildId(): Promise<void> {
  return SecureStore.deleteItemAsync(KEY)
}
