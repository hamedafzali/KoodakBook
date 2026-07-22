import { useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router } from 'expo-router'
import type { Child } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { setActiveChildId } from '@/lib/activeChild'
import ScreenBackground from '@/components/ScreenBackground'
import { colors, fonts } from '@/lib/theme'

/**
 * First-child creation (web: /onboarding). level starts at 1; the placement
 * probe measures and updates it the first time the child enters home.
 */
export default function Onboarding() {
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy || !name.trim()) return
    setBusy(true); setError(null); setLimitReached(false)
    const res = await api.post<Child>('/api/children', {
      name: name.trim(),
      birth_year: birthYear ? parseInt(birthYear, 10) : null,
      level: 1,
    })
    setBusy(false)
    if (!res.data) {
      setError(res.error ?? 'خطا')
      setLimitReached(!!res.error && res.error.includes('حداکثر'))
      return
    }
    // Placement runs on first entry to home (placement_done is false).
    await setActiveChildId(res.data.id)
    router.replace('/home')
  }

  return (
    <ScreenBackground variant="warm" decor>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.emoji}>🚀</Text>
      <Text style={styles.title}>معرفی کودک</Text>
      <Text style={styles.subtitle}>بیایید با هم شروع کنیم</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="اسم کودک (مثلاً لیلا)"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="سال تولد میلادی (اختیاری)"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          maxLength={4}
          value={birthYear}
          onChangeText={setBirthYear}
        />
      </View>

      <View style={styles.note}>
        <Text style={{ fontSize: 22 }}>🎮</Text>
        <Text style={styles.noteText}>
          بعد از این، یک بازی کوتاه و آسان انجام می‌دهیم تا بفهمیم از کجا شروع کنیم.
        </Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {limitReached && (
        <Pressable style={styles.upgradeButton} onPress={() => router.push('/parent/plan')}>
          <Text style={styles.upgradeText}>مشاهده پلن‌ها و ارتقا ✨</Text>
        </Pressable>
      )}

      <Pressable style={[styles.button, (busy || !name.trim()) && { opacity: 0.5 }]} disabled={busy || !name.trim()} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>بریم بازی کنیم! 🚀</Text>}
      </Pressable>
      </KeyboardAvoidingView>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emoji: { fontSize: 40 },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted },
  form: { width: '100%', maxWidth: 360, gap: 10, marginTop: 6 },
  input: {
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, fontFamily: fonts.regular, color: colors.text, textAlign: 'right',
  },
  note: {
    flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 360,
    backgroundColor: '#fef3c7', borderRadius: 14, padding: 12,
  },
  noteText: { flex: 1, fontSize: 12, fontFamily: fonts.regular, color: '#92400e', lineHeight: 20 },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
  upgradeButton: { backgroundColor: '#fef3c7', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 20 },
  upgradeText: { color: '#b45309', fontFamily: fonts.bold, fontSize: 14 },
  button: {
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14,
    width: '100%', maxWidth: 360, alignItems: 'center', marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
})
