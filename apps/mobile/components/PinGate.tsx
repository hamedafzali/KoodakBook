import { useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { api } from '@/lib/api'
import { colors, fonts } from '@/lib/theme'

const PIN_LENGTH = 4
const DIGITS = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const

type State = 'enter_pin' | 'set_pin' | 'reset'

/**
 * Mobile port of web's ParentGate (components/parent/ParentGate.tsx): Persian
 * numeric keypad + PIN dots, auto-verify at 4 digits, mandatory first-run
 * set-PIN with a confirm step, and password reset that flows into set-PIN.
 */
export default function PinGate({ hasPin, onUnlocked }: { hasPin: boolean; onUnlocked: () => void }) {
  const [state, setState] = useState<State>(hasPin ? 'enter_pin' : 'set_pin')
  const [step, setStep] = useState<'first' | 'confirm'>('first')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const shakeX = useRef(new Animated.Value(0)).current

  function triggerShake() {
    Animated.sequence(
      [-8, 8, -6, 6, -4, 4, 0].map((x) =>
        Animated.timing(shakeX, { toValue: x, duration: 55, useNativeDriver: true })
      )
    ).start()
  }

  async function verify(entered: string) {
    setBusy(true)
    const res = await api.post<{ ok: boolean; locked?: boolean }>('/api/auth/pin/verify', { pin: entered })
    setBusy(false)
    if (res.data?.ok) { onUnlocked(); return }
    triggerShake()
    setError(res.data?.locked
      ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کنید'
      : 'پین اشتباه است. دوباره تلاش کنید')
    setTimeout(() => setPin(''), 500)
  }

  async function savePin(p: string, c: string) {
    if (p !== c) {
      triggerShake()
      setError('پین‌ها مطابقت ندارند. دوباره امتحان کنید')
      setStep('first'); setPin(''); setConfirmPin('')
      return
    }
    setBusy(true)
    const res = await api.post<{ ok: boolean }>('/api/auth/pin/set', { pin: p })
    setBusy(false)
    if (res.data?.ok) { onUnlocked(); return }
    // A PIN already exists (e.g. set on web meanwhile) → fall back to entering it.
    setStep('first'); setPin(''); setConfirmPin(''); setError(null)
    setState('enter_pin')
  }

  function handleDigit(d: string) {
    if (busy) return
    setError(null)
    if (state === 'enter_pin') {
      const next = pin + d
      if (next.length <= PIN_LENGTH) {
        setPin(next)
        if (next.length === PIN_LENGTH) verify(next)
      }
    } else if (state === 'set_pin') {
      if (step === 'first') {
        const next = pin + d
        if (next.length <= PIN_LENGTH) {
          setPin(next)
          if (next.length === PIN_LENGTH) setStep('confirm')
        }
      } else {
        const next = confirmPin + d
        if (next.length <= PIN_LENGTH) {
          setConfirmPin(next)
          if (next.length === PIN_LENGTH) savePin(pin, next)
        }
      }
    }
  }

  function handleDelete() {
    if (busy) return
    setError(null)
    if (state === 'enter_pin') setPin((p) => p.slice(0, -1))
    else if (step === 'first') setPin((p) => p.slice(0, -1))
    else setConfirmPin((p) => p.slice(0, -1))
  }

  async function submitReset() {
    setBusy(true); setError(null)
    const res = await api.post<{ ok: boolean }>('/api/auth/pin/reset', { password })
    setBusy(false)
    if (res.data?.ok) {
      setPassword(''); setPin(''); setConfirmPin(''); setStep('first')
      setState('set_pin')
      return
    }
    triggerShake()
    setError('رمز عبور اشتباه است')
  }

  // ── Reset screen (password) ──
  if (state === 'reset') {
    return (
      <View style={styles.screen}>
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeX }] }]}>
          <Text style={styles.icon}>🔑</Text>
          <Text style={styles.title}>بازنشانی پین</Text>
          <Text style={styles.subtitle}>برای امنیت، رمز عبور حساب را وارد کنید</Text>
          <TextInput
            style={styles.password}
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null) }}
            secureTextEntry
            placeholder="رمز عبور"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[styles.submit, (busy || password.length < 6) && { opacity: 0.5 }]}
            disabled={busy || password.length < 6}
            onPress={submitReset}
          >
            <Text style={styles.submitText}>{busy ? '…' : 'تأیید و تنظیم پین جدید'}</Text>
          </Pressable>
          <Pressable onPress={() => { setState('enter_pin'); setPassword(''); setError(null) }} hitSlop={8}>
            <Text style={styles.link}>انصراف</Text>
          </Pressable>
        </Animated.View>
      </View>
    )
  }

  const currentPin = state === 'enter_pin' ? pin : step === 'first' ? pin : confirmPin
  const titleText = state === 'set_pin'
    ? step === 'first' ? 'پین والدین را تنظیم کنید' : 'پین را تأیید کنید'
    : 'پین والدین را وارد کنید'
  const subtitleText = state === 'set_pin'
    ? step === 'first' ? 'یک پین ۴ رقمی انتخاب کنید' : 'پین را دوباره وارد کنید'
    : 'این بخش برای والدین است'

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.card, { transform: [{ translateX: shakeX }] }]}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.subtitle}>{subtitleText}</Text>

        {/* PIN dots */}
        <View style={styles.dots}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View key={i} style={[styles.dot, i < currentPin.length && styles.dotFilled]} />
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Numeric keypad */}
        <View style={styles.pad}>
          {DIGITS.map((d, i) => (
            <Pressable key={d} style={styles.key} disabled={busy} onPress={() => handleDigit(String(i + 1))}>
              <Text style={styles.keyText}>{d}</Text>
            </Pressable>
          ))}
          <View style={styles.key} />
          <Pressable style={styles.key} disabled={busy} onPress={() => handleDigit('0')}>
            <Text style={styles.keyText}>۰</Text>
          </Pressable>
          <Pressable style={styles.key} disabled={busy} onPress={handleDelete}>
            <Text style={[styles.keyText, { color: colors.muted }]}>⌫</Text>
          </Pressable>
        </View>

        {state === 'enter_pin' && (
          <Pressable onPress={() => { setState('reset'); setPin(''); setError(null) }} hitSlop={8}>
            <Text style={styles.link}>پین را فراموش کردید؟</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.link}>برگشت</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Dark backdrop like web's slate-900 gate — visually "not the kids' app".
  screen: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 28, padding: 26, width: '100%', maxWidth: 330,
    alignItems: 'center', gap: 6,
  },
  icon: { fontSize: 36 },
  title: { fontSize: 19, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', marginBottom: 12 },
  dots: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: '#d1d5db' },
  dotFilled: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginBottom: 4 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  key: {
    width: '29%', height: 54, borderRadius: 14, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  keyText: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  password: {
    backgroundColor: '#f3f4f6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.regular, color: colors.text, width: '100%',
    textAlign: 'center', marginTop: 8,
  },
  submit: {
    backgroundColor: '#f59e0b', borderRadius: 14, paddingVertical: 13,
    width: '100%', alignItems: 'center', marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 15, fontFamily: fonts.bold },
  link: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 10, textDecorationLine: 'underline' },
})
