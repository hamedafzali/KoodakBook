import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, DashboardSummary } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import PinGate from '@/components/PinGate'
import { api } from '@/lib/api'
import { isParentUnlocked, setParentUnlocked } from '@/lib/parentGate'
import { colors, fonts } from '@/lib/theme'

type Me = { id: string; email: string; plan: string; has_pin: boolean }

/**
 * Parent hub (web: /parent/dashboard) behind the account PIN gate. First run
 * (no PIN yet) forces the set-PIN flow, like web. Leaving the parent area
 * re-locks it (see parent/_layout.tsx).
 */
export default function ParentHub() {
  const insets = useSafeAreaInsets()
  const { reset } = useLocalSearchParams<{ reset?: string }>()
  const [me, setMe] = useState<Me | null>(null)
  const [unlocked, setUnlocked] = useState(isParentUnlocked())
  const [children, setChildren] = useState<Child[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      // Re-sync lock state on focus — «تغییر پین» re-locks then returns here,
      // and the gate must reappear (in reset mode via ?reset=1).
      setUnlocked(isParentUnlocked())
      api.get<Me>('/api/auth/me').then((res) => {
        if (!cancelled && res.data) setMe(res.data)
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
    return (
      <PinGate
        hasPin={me.has_pin}
        initialReset={reset === '1'}
        onUnlocked={() => { setParentUnlocked(true); setUnlocked(true); setMe({ ...me, has_pin: true }) }}
      />
    )
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

      {/* Menu — the rest of the parent area */}
      <View style={styles.menu}>
        <MenuRow emoji="📈" label="پیشرفت کامل" sub="کلمات، درس‌ها، داستان‌ها، جلسات" onPress={() => router.push('/parent/progress')} />
        <View style={styles.menuDivider} />
        <MenuRow emoji="🧒" label="کودکان" sub="افزودن کودک، نام کاربری ورود بچه‌ها" onPress={() => router.push('/parent/children')} />
        <View style={styles.menuDivider} />
        <MenuRow emoji="💬" label="گفت‌وگوها" sub="بازبینی چت کودک با شخصیت‌ها" onPress={() => router.push('/parent/conversations')} />
        <View style={styles.menuDivider} />
        <MenuRow emoji="📤" label="اشتراک‌گذاری پیشرفت" onPress={() => router.push('/parent/share')} />
        <View style={styles.menuDivider} />
        <MenuRow emoji="💳" label="پلن و اشتراک" onPress={() => router.push('/parent/plan')} />
        <View style={styles.menuDivider} />
        <MenuRow emoji="⚙️" label="تنظیمات" sub="هدف روزانه، زبان ترجمه، پین، خروج" onPress={() => router.push('/parent/settings')} />
      </View>
    </ScrollView>
  )
}

function MenuRow({ emoji, label, sub, onPress }: { emoji: string; label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sub && <Text style={styles.menuSub}>{sub}</Text>}
      </View>
      <Text style={styles.menuChevron}>←</Text>
    </Pressable>
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
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
  menu: { backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuLabel: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  menuSub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  menuChevron: { fontSize: 18, color: colors.muted },
  menuDivider: { height: 1, backgroundColor: '#f1f5f9' },
})
