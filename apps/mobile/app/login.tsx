import { useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '@/lib/api'
import { setToken } from '@/lib/auth'
import { setActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'

type Mode = 'parent' | 'kid'

export default function Login() {
  const { expired } = useLocalSearchParams<{ expired?: string }>()
  const [mode, setMode] = useState<Mode>('parent')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function loginParent() {
    setBusy(true); setError(null)
    const res = await api.post<{ token: string; user_id: string }>('/api/auth/login', { email: email.trim(), password })
    setBusy(false)
    if (!res.data) { setError(res.error ?? 'ورود ناموفق بود'); return }
    await setToken(res.data.token)
    router.replace('/children')
  }

  // Kid mode mirrors web's /kid page: username only, token is the parent's,
  // and the child is picked implicitly.
  async function loginKid() {
    setBusy(true); setError(null)
    const res = await api.post<{ token: string; child_id: string; child_name: string }>(
      '/api/auth/child-login', { username: username.trim().toLowerCase() })
    setBusy(false)
    if (!res.data) { setError(res.error ?? 'ورود ناموفق بود'); return }
    await setToken(res.data.token)
    await setActiveChildId(res.data.child_id)
    router.replace('/home')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>کودک‌ بوک</Text>
      {expired === '1' && <Text style={styles.expired}>نشست شما تمام شد — دوباره وارد شوید</Text>}

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, mode === 'parent' && styles.tabActive]} onPress={() => setMode('parent')}>
          <Text style={[styles.tabText, mode === 'parent' && styles.tabTextActive]}>والدین</Text>
        </Pressable>
        <Pressable style={[styles.tab, mode === 'kid' && styles.tabActive]} onPress={() => setMode('kid')}>
          <Text style={[styles.tabText, mode === 'kid' && styles.tabTextActive]}>بچه‌ها</Text>
        </Pressable>
      </View>

      {mode === 'parent' ? (
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
      ) : (
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
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, busy && { opacity: 0.6 }]}
        disabled={busy}
        onPress={mode === 'parent' ? loginParent : loginKid}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ورود</Text>}
      </Pressable>

      {mode === 'parent' && (
        <Pressable onPress={() => router.replace('/signup')} hitSlop={8}>
          <Text style={styles.signupLink}>حساب ندارید؟ ثبت‌نام رایگان</Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 34, fontFamily: fonts.bold, color: colors.text },
  expired: { color: colors.danger, fontFamily: fonts.regular, fontSize: 14 },
  tabs: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: 14, padding: 4, gap: 4 },
  tab: { paddingVertical: 8, paddingHorizontal: 24, borderRadius: 10 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.primary, fontFamily: fonts.medium, fontSize: 15 },
  tabTextActive: { color: '#fff' },
  form: { width: '100%', maxWidth: 360, gap: 10 },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' },
  input: {
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
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
})
