import * as SecureStore from 'expo-secure-store'

// Same key name as web (lib/auth.ts) for symmetry, but stored in the device
// keychain/keystore — JWTs must not live in plain AsyncStorage.
const TOKEN_KEY = 'koodakbook_token'

export function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export function setToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token)
}

export function clearToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY)
}
