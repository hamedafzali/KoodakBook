import { useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { AppCharacter } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { setToken } from '@/lib/auth'
import { setActiveChildId } from '@/lib/activeChild'
import { getDeviceToken, setDeviceToken } from '@/lib/deviceToken'
import { characterEmoji } from '@/lib/characterEmoji'
import ScreenBackground from '@/components/ScreenBackground'
import { StoryScene } from '@/components/AuthScene'
import { colors, fonts } from '@/lib/theme'

type Mode = 'parent' | 'kid'

/* Kid login (mig 059), mirrors web's app/(auth)/kid/page.tsx: type your name,
 * then — if a parent set one up — tap your 3-character picture password
 * instead of typing anything else. On an already-bound device that's the
 * whole flow; on a new device, a one-time parent PIN check binds it so
 * future logins here skip straight to the picture step. No picture password
 * set → the original one-tap flow. */
type KidStep = 'name' | 'picture' | 'parent_pin'

export default function Login() {
  const { expired } = useLocalSearchParams<{ expired?: string }>()
  const [mode, setMode] = useState<Mode>('parent')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [kidStep, setKidStep] = useState<KidStep>('name')
  const [child, setChild] = useState<{ id: string; name: string } | null>(null)
  const [characters, setCharacters] = useState<AppCharacter[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [pin, setPin] = useState('')

  async function loginParent() {
    setBusy(true); setError(null)
    const res = await api.post<{ token: string; user_id: string }>('/api/auth/login', { email: email.trim(), password })
    setBusy(false)
    if (!res.data) { setError(res.error ?? 'ورود ناموفق بود'); return }
    await setToken(res.data.token)
    router.replace('/children')
  }

  async function finishKidLogin(token: string, childId: string, deviceToken?: string) {
    await setToken(token)
    await setActiveChildId(childId)
    if (deviceToken) await setDeviceToken(childId, deviceToken)
    router.replace('/home')
  }

  function resetKidFlow() {
    setKidStep('name'); setChild(null); setPicked([]); setPin(''); setError(null)
  }

  async function submitUsername() {
    setBusy(true); setError(null)
    const res = await api.post<{ token?: string; child_id: string; child_name: string; needs_picture_password?: boolean }>(
      '/api/auth/child-login', { username: username.trim().toLowerCase() })
    setBusy(false)
    if (!res.data) { setError(res.error ?? 'ورود ناموفق بود'); return }

    if (res.data.needs_picture_password) {
      setChild({ id: res.data.child_id, name: res.data.child_name })
      const chars = await api.get<AppCharacter[]>('/api/characters')
      setCharacters(chars.data ?? [])
      setKidStep('picture')
      return
    }
    await finishKidLogin(res.data.token!, res.data.child_id)
  }

  async function tapCharacter(slug: string) {
    if (!child || busy) return
    const next = [...picked, slug]
    setPicked(next)
    if (next.length < 3) return

    setBusy(true); setError(null)
    const deviceToken = await getDeviceToken(child.id)
    const res = await api.post<{ ok: boolean; locked?: boolean; needs_parent_pin?: boolean; token?: string; child_id: string; child_name: string }>(
      '/api/auth/child-login/verify-picture',
      { child_id: child.id, slugs: next, device_token: deviceToken ?? undefined }
    )
    setBusy(false)
    if (!res.data) { setError('یک مشکلی پیش آمد — دوباره امتحان کن'); setPicked([]); return }

    if (!res.data.ok) {
      setPicked([])
      setError(res.data.locked
        ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن'
        : 'ترتیب درست نبود. دوباره امتحان کن')
      return
    }
    if (res.data.needs_parent_pin) {
      setPicked([])
      setKidStep('parent_pin')
      return
    }
    await finishKidLogin(res.data.token!, res.data.child_id)
  }

  async function submitParentPin() {
    if (!child) return
    setBusy(true); setError(null)
    const res = await api.post<{ ok: boolean; locked?: boolean; token?: string; device_token?: string; child_id: string; child_name: string }>(
      '/api/auth/child-login/bind-device', { child_id: child.id, pin }
    )
    setBusy(false)
    if (!res.data) { setError('یک مشکلی پیش آمد — دوباره امتحان کن'); return }
    if (!res.data.ok) {
      setPin('')
      setError(res.data.locked ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن' : 'پین اشتباه است')
      return
    }
    await finishKidLogin(res.data.token!, res.data.child_id, res.data.device_token)
  }

  return (
    <ScreenBackground variant="warm" decor>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <StoryScene />
      <Text style={styles.title}>کودک‌ بوک</Text>
      {expired === '1' && <Text style={styles.expired}>نشست شما تمام شد — دوباره وارد شوید</Text>}

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, mode === 'parent' && styles.tabActive]} onPress={() => setMode('parent')}>
          <Text style={[styles.tabText, mode === 'parent' && styles.tabTextActive]}>والدین</Text>
        </Pressable>
        <Pressable style={[styles.tab, mode === 'kid' && styles.tabActive]} onPress={() => { setMode('kid'); resetKidFlow() }}>
          <Text style={[styles.tabText, mode === 'kid' && styles.tabTextActive]}>بچه‌ها</Text>
        </Pressable>
      </View>

      {mode === 'parent' && (
        <>
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="ایمیل"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="رمز عبور"
              placeholderTextColor={colors.muted}
              secureTextEntry
              textContentType="password"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={loginParent}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ورود</Text>}
          </Pressable>

          <Pressable onPress={() => router.replace('/signup')} hitSlop={8}>
            <Text style={styles.signupLink}>حساب ندارید؟ ثبت‌نام رایگان</Text>
          </Pressable>
        </>
      )}

      {mode === 'kid' && kidStep === 'name' && (
        <>
          <View style={styles.form}>
            <Text style={styles.hint}>اسمی که مامان یا بابا برایت ساخته را بنویس</Text>
            <TextInput
              style={[styles.input, styles.kidInput]}
              placeholder="username"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={submitUsername}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ورود</Text>}
          </Pressable>
        </>
      )}

      {mode === 'kid' && kidStep === 'picture' && (
        <View style={styles.form}>
          <Text style={styles.hint}>سلام {child?.name}! ۳ دوستت را به ترتیب لمس کن</Text>

          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.dot, i < picked.length && styles.dotFilled]} />
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.charGrid}>
            {characters.map(c => (
              <Pressable
                key={c.slug}
                style={styles.charCell}
                disabled={busy}
                onPress={() => tapCharacter(c.slug)}
              >
                <Text style={{ fontSize: 40 }}>{characterEmoji(c)}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={resetKidFlow} hitSlop={8}>
            <Text style={styles.signupLink}>اسم دیگری وارد کنم</Text>
          </Pressable>
        </View>
      )}

      {mode === 'kid' && kidStep === 'parent_pin' && (
        <View style={styles.form}>
          <Text style={styles.title}>🔒</Text>
          <Text style={styles.hint}>
            این دستگاه جدید است — برای اولین ورود {child?.name} روی این دستگاه، از مامان یا بابا بخواه پین را وارد کند
          </Text>
          <TextInput
            style={[styles.input, styles.kidInput]}
            placeholder="••••"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={pin}
            onChangeText={t => { setPin(t.replace(/\D/g, '').slice(0, 4)); setError(null) }}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, (busy || pin.length < 4) && { opacity: 0.6 }]}
            disabled={busy || pin.length < 4}
            onPress={submitParentPin}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>تأیید</Text>}
          </Pressable>

          <Pressable onPress={resetKidFlow} hitSlop={8}>
            <Text style={styles.signupLink}>بازگشت</Text>
          </Pressable>
        </View>
      )}
      </KeyboardAvoidingView>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 34, fontFamily: fonts.bold, color: colors.text },
  expired: { color: colors.danger, fontFamily: fonts.regular, fontSize: 14 },
  tabs: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: 14, padding: 4, gap: 4 },
  tab: { paddingVertical: 8, paddingHorizontal: 24, borderRadius: 10 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.primary, fontFamily: fonts.medium, fontSize: 15 },
  tabTextActive: { color: '#fff' },
  form: { width: '100%', maxWidth: 360, gap: 10, alignItems: 'center' },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' },
  input: {
    width: '100%', backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, fontFamily: fonts.regular, color: colors.text, textAlign: 'right',
  },
  kidInput: { textAlign: 'center', fontSize: 20, letterSpacing: 1 },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14,
    width: '100%', maxWidth: 360, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  signupLink: { color: '#059669', fontFamily: fonts.medium, fontSize: 14, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.primarySoft },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  charGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  charCell: {
    width: 80, height: 80, borderRadius: 18, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
})
