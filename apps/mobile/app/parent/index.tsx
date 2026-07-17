import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, DashboardSummary } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { isParentUnlocked, setParentUnlocked } from '@/lib/parentGate'
import { colors, fonts } from '@/lib/theme'

type Me = { id: string; email: string; plan: string; has_pin: boolean }

/**
 * Parent hub (web: /parent/dashboard) behind the account PIN. The PIN is a
 * local lock on the parent area only, never a login — wrong PIN answers 200
 * {ok:false} so it can't trip the 401 session-revoked handler.
 */
export default function ParentHub() {
  const insets = useSafeAreaInsets()
  const [me, setMe] = useState<Me | null>(null)
  const [unlocked, setUnlocked] = useState(isParentUnlocked())
  const [children, setChildren] = useState<Child[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      api.get<Me>('/api/auth/me').then((res) => {
        if (cancelled) return
        if (res.data) {
          setMe(res.data)
          if (!res.data.has_pin) { setParentUnlocked(true); setUnlocked(true) }
        }
      })
      api.get<Child[]>('/api/children').then((res) => {
        if (cancelled) return
        if (res.data) {
          setChildren(res.data)
          setSelected((cur) => cur ?? res.data![0]?.id ?? null)
        }
      })
      return () => { cancelled = true }
    }, [])
  )

  useFocusEffect(
    useCallback(() => {
      if (!selected || !unlocked) return
      let cancelled = false
      setSummary(null)
      api.get<DashboardSummary>(`/api/dashboard/${selected}`).then((res) => {
        if (!cancelled && res.data) setSummary(res.data)
      })
      return () => { cancelled = true }
    }, [selected, unlocked])
  )

  if (!me) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!unlocked) {
    return <PinGate onUnlocked={() => { setParentUnlocked(true); setUnlocked(true) }} />
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>حالت والدین 👨‍👩‍👧</Text>
          <Text style={styles.subtitle}>{me.email} · پلن {me.plan}</Text>
        </View>
      </View>

      {/* Child selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {children.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.chip, selected === c.id && styles.chipActive]}
            onPress={() => setSelected(c.id)}
          >
            <Text style={[styles.chipText, selected === c.id && { color: '#fff' }]}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {!summary ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <>
          <View style={styles.statsGrid}>
            <Stat emoji="🔥" label="روزهای پیاپی" value={summary.streak_days} />
            <Stat emoji="📝" label="کلمه‌های یادگرفته" value={summary.words_learned} />
            <Stat emoji="📖" label="قصه‌های تمام‌شده" value={summary.stories_completed} />
            <Stat emoji="📚" label="درس‌های تمام‌شده" value={summary.lessons_completed} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>وضعیت کلمه‌ها</Text>
            <MasteryRow label="تازه دیده" value={summary.mastery_breakdown.introduced} tint="#94a3b8" />
            <MasteryRow label="در حال تمرین" value={summary.mastery_breakdown.practicing} tint="#f59e0b" />
            <MasteryRow label="یادگرفته" value={summary.mastery_breakdown.mastered} tint="#22c55e" />
            <MasteryRow label="ماندگار شده" value={summary.mastery_breakdown.consolidated} tint="#0ea5e9" />
          </View>

          {summary.recent_badges.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>نشان‌های اخیر</Text>
              {summary.recent_badges.map((b) => (
                <Text key={b.id} style={styles.badgeRow}>🏅 {b.badge?.title ?? ''}</Text>
              ))}
            </View>
          )}
        </>
      )}

      <Pressable style={styles.linkCard} onPress={() => router.push('/parent/children')}>
        <Text style={{ fontSize: 26 }}>🧒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.linkTitle}>کودکان</Text>
          <Text style={styles.linkSub}>افزودن کودک، نام کاربری ورود بچه‌ها</Text>
        </View>
        <Text style={{ fontSize: 18, color: colors.muted }}>←</Text>
      </Pressable>

      {!me.has_pin && <SetPinCard onSet={() => setMe({ ...me, has_pin: true })} />}
    </ScrollView>
  )
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <Text style={styles.statValue}>{toPersianDigits(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function MasteryRow({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={styles.masteryRow}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={styles.masteryLabel}>{label}</Text>
      <Text style={styles.masteryValue}>{toPersianDigits(value)}</Text>
    </View>
  )
}

/** PIN entry, with password-based reset for forgotten PINs. */
function PinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const insets = useSafeAreaInsets()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)
  const [password, setPassword] = useState('')

  async function verify(value: string) {
    setPin(value)
    if (value.length < 4) return
    const res = await api.post<{ ok: boolean; locked?: boolean }>('/api/auth/pin/verify', { pin: value })
    if (res.data?.ok) { onUnlocked(); return }
    setPin('')
    setError(res.data?.locked ? 'قفل شد — ۱۵ دقیقه دیگر امتحان کنید' : 'رمز درست نبود')
  }

  async function reset() {
    const res = await api.post<{ ok: boolean }>('/api/auth/pin/reset', { password })
    if (res.data?.ok) onUnlocked()   // PIN cleared → area open; parent can set a new one inside
    else setError(res.error ?? 'رمز عبور درست نبود')
  }

  return (
    <View style={[styles.center, { gap: 14, padding: 24, paddingTop: insets.top + 24 }]}>
      <Text style={{ fontSize: 44 }}>🔒</Text>
      <Text style={styles.title}>حالت والدین</Text>
      {!forgot ? (
        <>
          <Text style={styles.subtitle}>رمز ۴ رقمی را وارد کنید</Text>
          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={verify}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={() => setForgot(true)} hitSlop={8}>
            <Text style={styles.forgot}>رمز را فراموش کردم</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>رمز عبور حساب را وارد کنید تا PIN پاک شود</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="رمز عبور"
            placeholderTextColor={colors.muted}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.button} onPress={reset}>
            <Text style={styles.buttonText}>پاک کردن PIN</Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.forgot}>برگشت</Text>
      </Pressable>
    </View>
  )
}

/** First-run PIN setup — optional, offered once the area is open with no PIN. */
function SetPinCard({ onSet }: { onSet: () => void }) {
  const [pin, setPin] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!/^\d{4}$/.test(pin)) { setError('PIN باید ۴ رقم باشد'); return }
    const res = await api.post<{ ok: boolean }>('/api/auth/pin/set', { pin })
    if (res.data?.ok) { setSaved(true); onSet() }
    else setError(res.error ?? 'ذخیره نشد')
  }

  if (saved) return null
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>قفل والدین 🔒</Text>
      <Text style={styles.linkSub}>
        یک رمز ۴ رقمی بگذارید تا بچه‌ها وارد این بخش نشوند
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1, textAlign: 'center' }]}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="۱۲۳۴"
          placeholderTextColor={colors.muted}
        />
        <Pressable style={styles.button} onPress={save}>
          <Text style={styles.buttonText}>ذخیره</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2, textAlign: 'center' },
  chip: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.card, borderWidth: 1, borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '48%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 18,
    padding: 14, alignItems: 'center', gap: 2,
  },
  statValue: { fontSize: 24, fontFamily: fonts.bold, color: colors.text },
  statLabel: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 8 },
  cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  masteryLabel: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.text },
  masteryValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  badgeRow: { fontSize: 13, fontFamily: fonts.regular, color: colors.text },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 18, padding: 16,
  },
  linkTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  linkSub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  pinInput: {
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12,
    fontSize: 28, letterSpacing: 12, color: colors.text, textAlign: 'center', minWidth: 160,
  },
  input: {
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, fontFamily: fonts.regular, color: colors.text, textAlign: 'right', minWidth: 200,
  },
  button: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontFamily: fonts.bold },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13 },
  forgot: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, textDecorationLine: 'underline' },
})
