import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { DashboardSummary } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'

/**
 * Share a child's progress (web: /parent/share). Web renders a canvas card and
 * shares the PNG; here we use the OS share sheet with a text summary — the same
 * native path web falls back to. A visual progress card previews what's shared.
 */
export default function ShareProgress() {
  const insets = useSafeAreaInsets()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const childId = await getActiveChildId()
      if (!childId) { router.replace('/children'); return }
      const res = await api.get<DashboardSummary>(`/api/dashboard/${childId}`)
      if (res.data) setSummary(res.data)
      else setError(res.error)
    }
    load()
  }, [])

  async function share() {
    if (!summary) return
    const message =
      `«${summary.child.name}» در کوداک‌بوک داره فارسی یاد می‌گیره! 🌟 ` +
      `تا حالا ${toPersianDigits(summary.words_learned)} کلمه یاد گرفته.`
    try {
      await Share.share({ message })
    } catch { /* user cancelled */ }
  }

  if (!summary) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <Text style={styles.title}>اشتراک‌گذاری پیشرفت 📤</Text>
      </View>

      {/* Preview card */}
      <View style={styles.card}>
        <Text style={styles.cardEmoji}>🌟</Text>
        <Text style={styles.cardName}>{summary.child.name}</Text>
        <Text style={styles.cardLine}>در کوداک‌بوک فارسی یاد می‌گیرد</Text>
        <View style={styles.cardStats}>
          <CardStat value={summary.words_learned} label="کلمه" />
          <CardStat value={summary.stories_completed} label="داستان" />
          <CardStat value={summary.streak_days} label="روز پیاپی" />
        </View>
      </View>

      <Pressable style={styles.shareButton} onPress={share}>
        <Text style={styles.shareButtonText}>اشتراک‌گذاری 📤</Text>
      </Pressable>
      <Text style={styles.hint}>پیام برای واتساپ، تلگرام یا هر اپ دیگری آماده می‌شود</Text>
    </View>
  )
}

function CardStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.cardStat}>
      <Text style={styles.cardStatValue}>{toPersianDigits(value)}</Text>
      <Text style={styles.cardStatLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, gap: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  card: {
    backgroundColor: colors.primary, borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 6, marginTop: 10,
  },
  cardEmoji: { fontSize: 44 },
  cardName: { fontSize: 26, fontFamily: fonts.bold, color: '#fff' },
  cardLine: { fontSize: 14, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.9)' },
  cardStats: { flexDirection: 'row', gap: 24, marginTop: 14 },
  cardStat: { alignItems: 'center' },
  cardStatValue: { fontSize: 26, fontFamily: fonts.bold, color: '#fff' },
  cardStatLabel: { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.85)' },
  shareButton: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  shareButtonText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  hint: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
