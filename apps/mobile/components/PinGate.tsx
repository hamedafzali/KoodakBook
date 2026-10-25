import { useRef, useState } from 'react'
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { goBack } from '@/lib/navigation'
import { api } from '@/lib/api'
import { colors, fonts, radii, spacing, textSize, ui } from '@/lib/theme'
import { authErrorMessage } from '@/lib/auth'
import { ParentLock } from '@/components/Illustrations'
import { ParentButton, ParentField, ParentNote, parentUI } from '@/components/ParentUI'

const PIN_LENGTH = 4
/** The gate's dark backdrop ("not the kids' app"; web's ParentGate is
 *  slate-900 too). Exported so the parent hub's loading frame before the
 *  gate is the same colour (no cream flash). */
export const PIN_BACKDROP = '#0f172a'
const DIGITS = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const
const DIGITS_FA = ['۰', '۱', '۲', '۳', '۴'] as const

type State = 'enter_pin' | 'set_pin' | 'reset'

/**
 * Mobile port of web's ParentGate (components/parent/ParentGate.tsx): Persian
 * numeric keypad + PIN dots, auto-verify at 4 digits, mandatory first-run
 * set-PIN with a confirm step, and password reset that flows into set-PIN.
 */
export default function PinGate({ hasPin, initialReset, onUnlocked }: {
  hasPin: boolean
  initialReset?: boolean
  onUnlocked: () => void
}) {
  // «تغییر پین» from settings lands here straight in reset mode (password →
  // set a new PIN), mirroring web's ?pin=reset.
  const [state, setState] = useState<State>(initialReset ? 'reset' : hasPin ? 'enter_pin' : 'set_pin')
  const [step, setStep] = useState<'first' | 'confirm'>('first')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // A new PIN whose save never reached the server (offline): kept, with a
  // retry, instead of being treated as "a PIN already exists".
  const [saveFailed, setSaveFailed] = useState(false)
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
    if (!res.data) {
      // The check never happened (offline, server down): not a wrong PIN, no
      // shake. The digits clear so the parent can simply enter it again.
      setError(authErrorMessage(res, 'اتصال برقرار نشد. دوباره تلاش کنید'))
      setPin('')
      return
    }
    triggerShake()
    setError(res.data.locked
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
    setBusy(true); setSaveFailed(false)
    const res = await api.post<{ ok: boolean }>('/api/auth/pin/set', { pin: p })
    setBusy(false)
    if (res.data?.ok) { onUnlocked(); return }
    // 409: a PIN already exists (the message check is the fallback for a
    // response without a status).
    if (res.status === 409 || res.error === 'PIN already set') {
      // The server says a PIN already exists (e.g. set on web meanwhile):
      // fall back to entering it.
      setStep('first'); setPin(''); setConfirmPin(''); setError(null)
      setState('enter_pin')
      return
    }
    // Anything else (offline, server error) saved nothing. Falling back to
    // PIN entry here used to lock the parent out behind a PIN that was never
    // stored. Keep the confirmed PIN and offer the save again.
    setSaveFailed(true)
    setError(authErrorMessage(res, 'پین ذخیره نشد. دوباره تلاش کنید'))
  }

  function handleDigit(d: string) {
    if (busy || saveFailed) return
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
    setError(null); setSaveFailed(false)
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
    // 422: wrong account password (message check as the fallback).
    if (res.status === 422 || res.error === 'Incorrect password') {
      triggerShake()
      setError('رمز عبور اشتباه است')
      return
    }
    // Offline / server error: the password was never checked.
    setError(authErrorMessage(res, 'اتصال برقرار نشد. دوباره تلاش کنید'))
  }

  // ── Reset screen (password) ──
  if (state === 'reset') {
    const canSubmit = !busy && password.length >= 6
    return (
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeX }] }]}>
            <LockDisc />
            <Text style={styles.title} accessibilityRole="header">بازنشانی پین</Text>
            <Text style={styles.subtitle}>برای امنیت، رمز عبور حساب را وارد کنید</Text>
            <ParentField
              label="رمز عبور حساب"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null) }}
              secureTextEntry
              textContentType="password"
              placeholder="رمز عبور"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => { if (canSubmit) void submitReset() }}
              error={error}
            />
            <ParentButton
              label="تأیید و تنظیم پین جدید" busy={busy} disabled={!busy && password.length < 6}
              onPress={() => { void submitReset() }} style={styles.wide}
            />
            <LinkButton label="انصراف" onPress={() => { setState('enter_pin'); setPassword(''); setError(null) }} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  const currentPin = state === 'enter_pin' ? pin : step === 'first' ? pin : confirmPin
  const titleText = state === 'set_pin'
    ? step === 'first' ? 'پین والدین را تنظیم کنید' : 'پین را تأیید کنید'
    : 'پین والدین را وارد کنید'
  const subtitleText = state === 'set_pin'
    ? step === 'first' ? 'یک پین ۴ رقمی انتخاب کنید' : 'پین را دوباره وارد کنید'
    : 'این بخش برای والدین است'
  const keysOff = busy || saveFailed

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeX }] }]}>
          <LockDisc />
          <Text style={styles.title} accessibilityRole="header">{titleText}</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>

          {/* PIN dots: read as a count, never the digits. They fill in the
              row's direction (from the right under RTL), the reading order. */}
          <View
            style={styles.dots}
            accessible
            accessibilityLabel={`${DIGITS_FA[currentPin.length]} رقم از ${DIGITS_FA[PIN_LENGTH]} وارد شده`}
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.dot, i < currentPin.length && styles.dotFilled]} />
            ))}
          </View>

          {error ? <ParentNote text={error} tone="error" /> : null}
          {saveFailed && (
            <ParentButton
              label="ذخیره دوباره پین" busy={busy}
              onPress={() => { void savePin(pin, confirmPin) }} style={styles.wide}
            />
          )}

          {/* Numeric keypad: a row per three keys (a wrapped row mirrors
              under RTL like the web gate's grid, so ۱ sits at the right). */}
          <View style={styles.pad}>
            {DIGITS.map((d, i) => (
              <Key key={d} label={d} disabled={keysOff} onPress={() => handleDigit(String(i + 1))} />
            ))}
            <View style={styles.keySpacer} />
            <Key label="۰" disabled={keysOff} onPress={() => handleDigit('0')} />
            <Key label="پاک کردن" icon disabled={busy} onPress={handleDelete} />
          </View>

          {state === 'enter_pin' && (
            <LinkButton label="پین را فراموش کردید؟" onPress={() => { setState('reset'); setPin(''); setError(null) }} />
          )}
          <LinkButton label="برگشت" onPress={() => goBack('/home')} />
        </Animated.View>
      </ScrollView>
    </View>
  )
}

/** The gate's security cue: the shared parent-lock badge (Illustrations.tsx,
 *  the reference's parent-area lock), decorative -- the title says it. */
function LockDisc() {
  return <View style={styles.lockDisc}><ParentLock size={60} /></View>
}

/** A keypad key: a quiet tactile face (3pt edge that sinks when pressed),
 *  the adult cousin of the child app's clay. Fixed size, so its digit is
 *  capped at 1.3x text scale. */
function Key({ label, onPress, disabled, icon = false }: {
  label: string; onPress: () => void; disabled: boolean; icon?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={styles.keyHit}
    >
      {({ pressed }) => (
        <View style={[styles.key, pressed && !disabled && styles.keyPressed, disabled && styles.keyDisabled]}>
          {icon ? (
            <Svg width={26} height={26} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Path
                d="M9 5h10.5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z M12.5 9.5l5 5 M17.5 9.5l-5 5"
                stroke={ui.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"
              />
            </Svg>
          ) : (
            <Text style={styles.keyText} maxFontSizeMultiplier={1.3}>{label}</Text>
          )}
        </View>
      )}
    </Pressable>
  )
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" style={styles.linkHit}>
      {({ pressed }) => <Text style={[styles.link, pressed && { opacity: 0.6 }]}>{label}</Text>}
    </Pressable>
  )
}

const KEY_EDGE = 3

const styles = StyleSheet.create({
  // Dark backdrop like web's slate-900 gate — visually "not the kids' app".
  screen: { flex: 1, backgroundColor: PIN_BACKDROP },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, width: '100%', maxWidth: 340,
    alignItems: 'center', gap: spacing.sm,
  },
  wide: { alignSelf: 'stretch' },
  lockDisc: { marginBottom: spacing.xs },
  title: { fontSize: textSize.cardTitle, fontFamily: fonts.bold, color: parentUI.text, textAlign: 'center' },
  subtitle: { fontSize: textSize.caption, fontFamily: fonts.regular, color: parentUI.muted, textAlign: 'center', marginBottom: spacing.sm },
  dots: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  dot: { width: 16, height: 16, borderRadius: radii.pill, borderWidth: 2, borderColor: ui.track },
  dotFilled: { backgroundColor: parentUI.accent, borderColor: colors.primaryDeep },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'stretch', rowGap: spacing.sm + 2, marginTop: spacing.xs },
  keyHit: { width: '33.33%', paddingHorizontal: spacing.xs + 1 },
  keySpacer: { width: '33.33%' },
  key: {
    height: 58, borderRadius: radii.md, backgroundColor: parentUI.field,
    borderWidth: 1, borderColor: parentUI.line, borderBottomWidth: KEY_EDGE + 1, borderBottomColor: ui.track,
    alignItems: 'center', justifyContent: 'center',
  },
  // Sinks by the edge it loses: the key's bottom stays put.
  keyPressed: { borderBottomWidth: 1, marginTop: KEY_EDGE, height: 58 - KEY_EDGE, backgroundColor: parentUI.accentSoft },
  keyDisabled: { opacity: ui.disabledOpacity },
  keyText: { fontSize: textSize.h2, fontFamily: fonts.bold, color: parentUI.text },
  linkHit: { minHeight: ui.hit, justifyContent: 'center', paddingHorizontal: spacing.sm },
  link: { fontSize: textSize.caption, fontFamily: fonts.medium, color: parentUI.muted, textDecorationLine: 'underline' },
})
