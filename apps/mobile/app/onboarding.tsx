import { useState } from 'react'
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { router } from 'expo-router'
import type { Child } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { setActiveChildId } from '@/lib/activeChild'
import { authErrorMessage } from '@/lib/auth'
import ScreenBackground from '@/components/ScreenBackground'
import { AuthField, AuthHero, AuthNote, AuthSheet, AuthTitle } from '@/components/AuthScene'
import { ClayButton, HostAvatar } from '@/components/Clay'
import { colors, fonts, radii, ramps, spacing, textSize, textStart } from '@/lib/theme'

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
      setError(authErrorMessage(res, 'ساخت پروفایل انجام نشد. دوباره تلاش کنید'))
      setLimitReached(!!res.error && res.error.includes('حداکثر'))
      return
    }
    // Placement runs on first entry to home (placement_done is false).
    await setActiveChildId(res.data.id)
    router.replace('/home')
  }

  return (
    <ScreenBackground variant="warm">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <AuthHero character="roozi" emotion="encouraging" motif="path" />
      <AuthSheet>
      <AuthTitle title="معرفی کودک" lead="بیایید با هم شروع کنیم" />

      <AuthField
        label="اسم کودک"
        placeholder="مثلاً لیلا"
        returnKeyType="next"
        value={name}
        onChangeText={(t) => { setName(t); setError(null) }}
      />
      <AuthField
        label="سال تولد میلادی (اختیاری)"
        placeholder="2019"
        keyboardType="number-pad"
        maxLength={4}
        value={birthYear}
        onChangeText={setBirthYear}
      />

      {/* What happens next, with its host: سیمرغ runs the placement game. */}
      <View style={styles.note}>
        <HostAvatar ramp={ramps.brand} size={52} character="simorgh" emotion="encouraging" />
        <Text style={styles.noteText}>
          بعد از این، یک بازی کوتاه و آسان انجام می‌دهیم تا بفهمیم از کجا شروع کنیم.
        </Text>
      </View>

      {error && <AuthNote text={error} />}
      {limitReached && (
        <ClayButton
          ramp={ramps.brand} tone="soft" label="مشاهده پلن‌ها و ارتقا"
          onPress={() => router.push('/parent/plan')}
        />
      )}

      <ClayButton
        ramp={ramps.brand} label="بریم بازی کنیم!" busy={busy} disabled={!name.trim()}
        onPress={submit}
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
  note: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4,
    backgroundColor: ramps.brand.soft, borderRadius: radii.md, padding: spacing.sm + 4,
    borderWidth: 2, borderColor: ramps.brand.bright,
  },
  noteText: { flex: 1, fontSize: textSize.caption + 1, fontFamily: fonts.medium, color: colors.text, lineHeight: 24, textAlign: textStart },
})
