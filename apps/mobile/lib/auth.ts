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

// The backend's auth errors are English; the api client's own network
// errors are already Persian («اینترنت قطع است…», «اتصال برقرار نشد…»).
const AUTH_ERRORS: Record<string, string> = {
  'Invalid email or password': 'ایمیل یا رمز عبور اشتباه است',
  'This account is suspended': 'این حساب غیرفعال شده است',
  'Incorrect password': 'رمز عبور اشتباه است',
  'PIN already set': 'پین قبلاً تنظیم شده است',
  'Email already registered': 'این ایمیل قبلاً ثبت شده است — وارد شوید',
}

/** What the auth helpers read from an ApiResponse. */
type FailedResponse = { error: string | null; status?: number }

/**
 * The message to show for a failed auth call, most specific first:
 *   1. `overrides` by HTTP status (e.g. { 401: 'wrong email or password' }),
 *   2. `overrides` by the backend's message,
 *   3. the Persian wording of a known English backend message,
 *   4. any Persian message as-is (the api client's network errors, Persian
 *      backend errors such as the 429 «کمی صبر کن…»),
 *   5. `fallback`.
 * Keeps a dropped connection from reading as "wrong password" and English
 * text off the screen. Message matching stays as the fallback for a response
 * without a status.
 */
export function authErrorMessage(
  res: FailedResponse, fallback: string, overrides: Record<string | number, string> = {},
): string {
  if (res.status !== undefined && overrides[res.status]) return overrides[res.status]
  const error = res.error
  if (!error) return fallback
  if (overrides[error]) return overrides[error]
  if (AUTH_ERRORS[error]) return AUTH_ERRORS[error]
  return /[؀-ۿ]/.test(error) ? error : fallback
}

/** True when no HTTP response arrived (offline, server unreachable): the api
 *  client sets `status` on every response it gets. A response without a
 *  status (hand-built) falls back to the client's own offline wording. */
export function isNetworkError(res: FailedResponse): boolean {
  if (!res.error || res.status !== undefined) return false
  return /اینترنت قطع است|اتصال برقرار نشد/.test(res.error)
}
