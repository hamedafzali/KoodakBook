import { useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router } from 'expo-router'
import { api } from '@/lib/api'
import { setToken } from '@/lib/auth'
import { colors, fonts } from '@/lib/theme'

/** New-account signup (web: /(auth)/signup). Lands in onboarding to create
 *  the first child; the PIN is set later on first entry to parent mode. */
export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    setBusy(true); setError(null)
    const res = await api.post<{ token: string }>('/api/auth/signup', { email: email.trim(), password })
    setBusy(false)
    if (!res.data) { setError(res.error ?? 'مشکلی پیش آمد'); return }
    await setToken(res.data.token)
    router.replace('/onboarding')
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.emoji}>🎈</Text>
      <Text style={styles.title}>شروع ماجراجویی فارسی</Text>
      <Text style={styles.subtitle}>رایگان است — نه کارت بانکی، نه تعهدی</Text>

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
          placeholder="رمز عبور (حداقل ۶ کاراکتر)"
          placeholderTextColor={colors.muted}
          secureTextEntry
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ثبت‌نام رایگان</Text>}
      </Pressable>

      <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
        <Text style={styles.link}>حساب دارید؟ ورود</Text>
      </Pressable>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  emoji: { fontSize: 40 },
  title: { fontSize: 24, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  form: { width: '100%', maxWidth: 360, gap: 10, marginTop: 6 },
  input: {
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, fontFamily: fonts.regular, color: colors.text, textAlign: 'right',
  },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
  button: {
    backgroundColor: '#10b981', borderRadius: 16, paddingVertical: 14,
    width: '100%', maxWidth: 360, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  link: { color: '#059669', fontFamily: fonts.medium, fontSize: 14, marginTop: 4 },
})
