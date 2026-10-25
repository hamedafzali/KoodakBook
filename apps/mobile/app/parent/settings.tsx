import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TRANSLATION_LANGS } from '@koodakbook/shared'
import {
  ParentButton, ParentCard, ParentChip, ParentDivider, ParentHeader, ParentPage, ParentRow, ParentSection, parentUI,
} from '@/components/ParentUI'
import { api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { clearActiveChildId } from '@/lib/activeChild'
import { isParentUnlocked, setParentUnlocked } from '@/lib/parentGate'
import {
  ensurePrefs, getDailyGoal, getTranslationLang, prefsReady, setDailyGoal, setTranslationLang,
} from '@/lib/prefs'
import { fonts, spacing, textSize, textStart } from '@/lib/theme'

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
  const [loggingOutBusy, setLoggingOutBusy] = useState(false)
  // Gates, checked during render (not in an effect after it): a deep link
  // here while locked used to paint the whole settings page for a frame
  // before the focus effect sent it to the PIN, and on a cold start the
  // goal/language chips could show the defaults and then jump to the
  // stored values.
  const allowed = isParentUnlocked()
  const [ready, setReady] = useState(prefsReady())

  useFocusEffect(
    useCallback(() => {
      if (!isParentUnlocked()) { router.replace('/parent'); return }
      // Prefs may not have hydrated yet on a cold start — refresh once ready.
      ensurePrefs().then(() => { setGoal(getDailyGoal()); setLang(getTranslationLang()); setReady(true) })
    }, [])
  )

  function chooseGoal(v: number) { setGoal(v); setDailyGoal(v) }
  function chooseLang(code: string) { setLang(code); setTranslationLang(code) }

  // One logout at a time: a double tap used to post logout and replace to
  // /login twice. Reset only if clearing the stored session fails.
  const loggingOut = useRef(false)
  async function logout() {
    if (loggingOut.current) return
    loggingOut.current = true
    setLoggingOutBusy(true)
    try {
      await api.post('/api/auth/logout', {})
      await clearToken()
      await clearActiveChildId()
      setParentUnlocked(false)
      router.replace('/login')
    } catch {
      loggingOut.current = false
      setLoggingOutBusy(false)
    }
  }

  // Change PIN: re-lock and open the gate straight in reset mode (verify
  // account password → set a new PIN), same as web.
  function changePin() {
    setParentUnlocked(false)
    router.replace('/parent?reset=1')
  }

  if (!allowed) return <View style={styles.blank} />
  if (!ready) {
    return (
      <ParentPage>
        <ParentHeader title="تنظیمات" />
        <View style={styles.loading}><ActivityIndicator color={parentUI.accentText} accessibilityLabel="در حال بارگذاری" /></View>
      </ParentPage>
    )
  }

  return (
    <ParentPage>
      <ParentHeader title="تنظیمات" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
      >

      {/* Learning settings */}
      <ParentSection label="تنظیمات یادگیری" />
      <ParentCard>
        <Text style={styles.fieldTitle}>هدف روزانه</Text>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="هدف روزانه">
          {DAILY_GOALS.map((g) => (
            <ParentChip key={g.value} label={g.label} selected={goal === g.value} onPress={() => chooseGoal(g.value)} />
          ))}
        </View>

        <ParentDivider />

        <Text style={styles.fieldTitle}>زبان ترجمه‌ی داستان‌ها</Text>
        <Text style={styles.fieldHint}>زیر متن فارسی نمایش داده می‌شود</Text>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="زبان ترجمه‌ی داستان‌ها">
          <ParentChip label="خاموش" selected={lang === 'none'} onPress={() => chooseLang('none')} />
          {TRANSLATION_LANGS.map((l) => (
            <ParentChip
              key={l.code}
              label={`${l.flag} ${l.label}`}
              accessibilityLabel={l.label}
              selected={lang === l.code}
              onPress={() => chooseLang(l.code)}
            />
          ))}
        </View>
      </ParentCard>

      {/* Navigation to other parent sections */}
      <ParentSection label="کودکان و محتوا" />
      <ParentCard style={styles.menu}>
        <ParentRow label="کودکان" icon="person" onPress={() => router.push('/parent/children')} />
        <ParentDivider />
        <ParentRow label="پیشرفت کامل" icon="trending-up" onPress={() => router.push('/parent/progress')} />
        <ParentDivider />
        <ParentRow label="گفت‌وگوهای کودک با شخصیت‌ها" icon="chatbubbles" onPress={() => router.push('/parent/conversations')} />
      </ParentCard>

      <ParentSection label="اشتراک" />
      <ParentCard style={styles.menu}>
        <ParentRow label="پلن و اشتراک" icon="card" onPress={() => router.push('/parent/plan')} />
        <ParentDivider />
        <ParentRow label="اشتراک‌گذاری پیشرفت" icon="share-social" onPress={() => router.push('/parent/share')} />
      </ParentCard>

      {/* Account */}
      <ParentSection label="حساب کاربری" />
      <ParentCard style={styles.menu}>
        <ParentRow label="قوانین و حریم خصوصی" icon="document-text" onPress={() => router.push('/legal')} />
        <ParentDivider />
        <ParentRow label="تغییر پین والدین" icon="lock-closed" onPress={changePin} />
        <ParentDivider />
        {!confirmLogout ? (
          <ParentRow label="خروج از حساب" icon="log-out" tone="danger" onPress={() => setConfirmLogout(true)} />
        ) : (
          <View style={styles.confirm} accessibilityLiveRegion="polite">
            <Text style={styles.confirmText}>مطمئنید که می‌خواهید خارج شوید؟</Text>
            <View style={styles.confirmButtons}>
              <ParentButton label="بله، خروج" tone="danger" busy={loggingOutBusy} onPress={() => { void logout() }} style={{ flex: 1 }} />
              <ParentButton label="انصراف" tone="secondary" onPress={() => setConfirmLogout(false)} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </ParentCard>

      <Text style={styles.version}>KoodakBook v0.1.0</Text>
      </ScrollView>
    </ParentPage>
  )
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: parentUI.page },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md + 4, gap: spacing.sm + 4 },
  menu: { paddingVertical: 0, gap: 0 },
  fieldTitle: { fontSize: textSize.caption + 1, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  fieldHint: { fontSize: textSize.micro + 1, fontFamily: fonts.regular, color: parentUI.muted, marginTop: -6, textAlign: textStart },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  confirm: { paddingVertical: spacing.sm + 4, gap: spacing.sm + 2 },
  confirmText: { fontSize: textSize.caption + 1, fontFamily: fonts.medium, color: parentUI.text, textAlign: textStart },
  confirmButtons: { flexDirection: 'row', gap: spacing.sm + 2 },
  version: { textAlign: 'center', fontSize: textSize.micro + 1, fontFamily: fonts.regular, color: parentUI.muted, marginTop: spacing.sm },
})
