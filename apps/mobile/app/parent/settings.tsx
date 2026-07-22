import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TRANSLATION_LANGS } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { clearActiveChildId } from '@/lib/activeChild'
import { isParentUnlocked, setParentUnlocked } from '@/lib/parentGate'
import {
  ensurePrefs, getDailyGoal, getTranslationLang, setDailyGoal, setTranslationLang,
} from '@/lib/prefs'
import { colors, fonts } from '@/lib/theme'

const DAILY_GOALS = [
  { value: 5, label: '۵ دقیقه' },
  { value: 10, label: '۱۰ دقیقه' },
  { value: 15, label: '۱۵ دقیقه' },
  { value: 20, label: '۲۰ دقیقه' },
]

/** Parent settings (web: /parent/settings) — learning prefs + account. */
export default function Settings() {
  const insets = useSafeAreaInsets()
  const [goal, setGoal] = useState(getDailyGoal())
  const [lang, setLang] = useState(getTranslationLang())
  const [confirmLogout, setConfirmLogout] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!isParentUnlocked()) { router.replace('/parent'); return }
      // Prefs may not have hydrated yet on a cold start — refresh once ready.
      ensurePrefs().then(() => { setGoal(getDailyGoal()); setLang(getTranslationLang()) })
    }, [])
  )

  function chooseGoal(v: number) { setGoal(v); setDailyGoal(v) }
  function chooseLang(code: string) { setLang(code); setTranslationLang(code) }

  async function logout() {
    await api.post('/api/auth/logout', {})
    await clearToken()
    await clearActiveChildId()
    setParentUnlocked(false)
    router.replace('/login')
  }

  // Change PIN: re-lock and open the gate straight in reset mode (verify
  // account password → set a new PIN), same as web.
  function changePin() {
    setParentUnlocked(false)
    router.replace('/parent?reset=1')
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <Text style={styles.title}>تنظیمات ⚙️</Text>
      </View>

      {/* Learning settings */}
      <Text style={styles.sectionLabel}>تنظیمات یادگیری</Text>
      <View style={styles.card}>
        <Text style={styles.fieldTitle}>هدف روزانه</Text>
        <View style={styles.chips}>
          {DAILY_GOALS.map((g) => (
            <Pressable
              key={g.value}
              style={[styles.chip, goal === g.value && styles.chipActive]}
              onPress={() => chooseGoal(g.value)}
            >
              <Text style={[styles.chipText, goal === g.value && { color: '#fff' }]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.fieldTitle}>زبان ترجمه‌ی داستان‌ها</Text>
        <Text style={styles.fieldHint}>زیر متن فارسی نمایش داده می‌شود</Text>
        <View style={styles.chips}>
          <Pressable
            style={[styles.chip, lang === 'none' && styles.chipActive]}
            onPress={() => chooseLang('none')}
          >
            <Text style={[styles.chipText, lang === 'none' && { color: '#fff' }]}>خاموش</Text>
          </Pressable>
          {TRANSLATION_LANGS.map((l) => (
            <Pressable
              key={l.code}
              style={[styles.chip, lang === l.code && styles.chipActive]}
              onPress={() => chooseLang(l.code)}
            >
              <Text style={[styles.chipText, lang === l.code && { color: '#fff' }]}>{l.flag} {l.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Navigation to other parent sections */}
      <Text style={styles.sectionLabel}>کودکان و محتوا</Text>
      <View style={styles.card}>
        <MenuRow label="کودکان" emoji="🧒" onPress={() => router.push('/parent/children')} />
        <View style={styles.divider} />
        <MenuRow label="پیشرفت کامل" emoji="📈" onPress={() => router.push('/parent/progress')} />
        <View style={styles.divider} />
        <MenuRow label="گفت‌وگوهای کودک با شخصیت‌ها" emoji="💬" onPress={() => router.push('/parent/conversations')} />
      </View>

      <Text style={styles.sectionLabel}>اشتراک</Text>
      <View style={styles.card}>
        <MenuRow label="پلن و اشتراک" emoji="💳" onPress={() => router.push('/parent/plan')} />
        <View style={styles.divider} />
        <MenuRow label="اشتراک‌گذاری پیشرفت" emoji="📤" onPress={() => router.push('/parent/share')} />
      </View>

      {/* Account */}
      <Text style={styles.sectionLabel}>حساب کاربری</Text>
      <View style={styles.card}>
        <MenuRow label="تغییر پین والدین" emoji="🔒" onPress={changePin} />
        <View style={styles.divider} />
        {!confirmLogout ? (
          <Pressable style={styles.row} onPress={() => setConfirmLogout(true)}>
            <Text style={{ fontSize: 20 }}>🚪</Text>
            <Text style={[styles.rowLabel, { color: colors.danger }]}>خروج از حساب</Text>
          </Pressable>
        ) : (
          <View style={{ paddingVertical: 12, gap: 10 }}>
            <Text style={styles.confirmText}>مطمئنید که می‌خواهید خارج شوید؟</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[styles.confirmButton, { backgroundColor: colors.danger }]} onPress={logout}>
                <Text style={styles.confirmButtonText}>بله، خروج</Text>
              </Pressable>
              <Pressable style={[styles.confirmButton, { backgroundColor: '#e2e8f0' }]} onPress={() => setConfirmLogout(false)}>
                <Text style={[styles.confirmButtonText, { color: colors.text }]}>انصراف</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.version}>KoodakBook v0.1.0</Text>
    </ScrollView>
  )
}

function MenuRow({ label, emoji, onPress }: { label: string; emoji: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>←</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  sectionLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted, marginTop: 8, marginBottom: -2 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 10 },
  fieldTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  fieldHint: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: -6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontFamily: fonts.medium, color: colors.text },
  divider: { height: 1, backgroundColor: '#f1f5f9' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.text },
  chevron: { fontSize: 18, color: colors.muted },
  confirmText: { fontSize: 14, fontFamily: fonts.regular, color: colors.text },
  confirmButton: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 14, fontFamily: fonts.bold },
  version: { textAlign: 'center', fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 8 },
})
