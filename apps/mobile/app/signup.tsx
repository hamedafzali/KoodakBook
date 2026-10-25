import { useState } from 'react'
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text,
} from 'react-native'
import { router } from 'expo-router'
import { api } from '@/lib/api'
import { authErrorMessage, setToken } from '@/lib/auth'
import ScreenBackground from '@/components/ScreenBackground'
import { AuthField, AuthHero, AuthNote, AuthSheet, AuthTitle } from '@/components/AuthScene'
import { ClayButton, TextButton } from '@/components/Clay'
import { auth, fonts, ramps, textSize, ui } from '@/lib/theme'

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
    if (!res.data) {
      // The backend answers bad input with "Invalid email or password" here.
      setError(authErrorMessage(res, 'مشکلی پیش آمد. دوباره تلاش کنید', {
        400: 'یک ایمیل درست و رمز عبور حداقل ۶ کاراکتری لازم است',
        409: 'این ایمیل قبلاً ثبت شده است — وارد شوید',
        'Invalid email or password': 'یک ایمیل درست و رمز عبور حداقل ۶ کاراکتری لازم است',
      }))
      return
    }
    await setToken(res.data.token)
    router.replace('/onboarding')
  }

  return (
    <ScreenBackground variant="warm">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <AuthHero character="charkhi" emotion="encouraging" motif="balloon" />
      <AuthSheet>
      <AuthTitle title="شروع ماجراجویی فارسی" lead="رایگان است — نه کارت بانکی، نه تعهدی" />

      <AuthField
        label="ایمیل"
        placeholder="name@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        value={email}
        onChangeText={(t) => { setEmail(t); setError(null) }}
        error={error}
      />
      <AuthField
        label="رمز عبور"
        placeholder="حداقل ۶ کاراکتر"
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={() => { void submit() }}
        value={password}
        onChangeText={(t) => { setPassword(t); setError(null) }}
        error={error}
      />

      {error && <AuthNote text={error} />}

      {/* Signup keeps its green identity (web's AuthShell), as the lessons ramp. */}
      <ClayButton ramp={ramps.lessons} label="ثبت‌نام رایگان" busy={busy} onPress={submit} />

      <Text style={styles.consent}>
        با ثبت‌نام، <Text style={styles.consentLink} accessibilityRole="link" onPress={() => router.push('/legal')}>شرایط استفاده</Text> و{' '}
        <Text style={styles.consentLink} accessibilityRole="link" onPress={() => router.push('/legal')}>حریم خصوصی</Text> را می‌پذیرید
      </Text>

      <TextButton
        label="حساب دارید؟ ورود"
        accessibilityRole="link"
        color={auth.signup.accentDeep}
        onPress={() => router.replace('/login')}
      />
      </AuthSheet>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  // ui.textMuted, not colors.muted: 5.6:1 on the warm sheet.
  consent: {
    fontSize: textSize.caption - 1, fontFamily: fonts.regular, color: ui.textMuted, textAlign: 'center',
    lineHeight: 20,
  },
  consentLink: { color: auth.signup.accentDeep, fontFamily: fonts.bold, textDecorationLine: 'underline' },
})
