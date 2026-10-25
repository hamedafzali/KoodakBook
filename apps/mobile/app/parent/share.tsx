import { useCallback, useEffect, useState } from 'react'
import { Share, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { DashboardSummary } from '@koodakbook/shared'
import { toPersianDigits, buildShareText } from '@koodakbook/shared'
import ParentLoadState, { PARENT_FALLBACK_ERROR } from '@/components/ParentLoadState'
import { ParentButton, ParentHeader, ParentPage, parentUI } from '@/components/ParentUI'
import { CharacterArt } from '@/components/Clay'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { isParentUnlocked } from '@/lib/parentGate'
import { fonts, radii, ramps, spacing, textSize } from '@/lib/theme'

/**
 * Share a child's progress (web: /parent/share). Web renders a canvas card and
 * shares the PNG; here we use the OS share sheet with a text summary — the same
 * native path web falls back to. A visual progress card previews what's shared.
 */
export default function ShareProgress() {
  const insets = useSafeAreaInsets()
  // The child picked on the parent hub (?child=<id>); an older link without
  // it falls back to the device's active child, as before.
  const { child: childParam } = useLocalSearchParams<{ child?: string }>()
  const allowed = isParentUnlocked()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }

  // A deep link straight here must face the PIN like the hub does.
  useFocusEffect(useCallback(() => {
    if (!isParentUnlocked()) router.replace('/parent')
  }, []))

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    async function load() {
      const childId = childParam || await getActiveChildId().catch(() => null)
      if (cancelled) return
      if (!childId) { router.replace('/parent'); return }
      const res = await api.get<DashboardSummary>(`/api/dashboard/${childId}`)
      if (cancelled) return
      if (res.data) setSummary(res.data)
      else setError(res.error || PARENT_FALLBACK_ERROR)
    }
    load()
    return () => { cancelled = true }
  }, [allowed, childParam, reloadKey])

  async function share() {
    if (!summary) return
    const message = buildShareText(summary)
    try {
      await Share.share({ message })
    } catch { /* user cancelled */ }
  }

  if (!allowed) return <View style={styles.center} />
  if (!summary) return <ParentLoadState title="اشتراک‌گذاری پیشرفت" error={error} onRetry={retry} />

  return (
    <ParentPage>
      <ParentHeader title="اشتراک‌گذاری پیشرفت" />
      <View style={[styles.container, { paddingBottom: insets.bottom + spacing.lg }]}>

      {/* Preview of what is shared: the one warm, celebratory card in the
          parent area (it is the child's achievement), read as one sentence. */}
      <View
        style={styles.card}
        accessible
        accessibilityLabel={`پیش‌نمایش: ${summary.child.name} در کودک‌بوک فارسی یاد می‌گیرد. ${toPersianDigits(summary.words_learned)} کلمه، ${toPersianDigits(summary.stories_completed)} داستان، ${toPersianDigits(summary.streak_days)} روز پیاپی`}
      >
        <CharacterArt character="simorgh" emotion="proud" size={72} />
        <Text style={styles.cardName}>{summary.child.name}</Text>
        <Text style={styles.cardLine}>در کودک‌بوک فارسی یاد می‌گیرد</Text>
        <View style={styles.cardStats}>
          <CardStat value={summary.words_learned} label="کلمه" />
          <CardStat value={summary.stories_completed} label="داستان" />
          <CardStat value={summary.streak_days} label="روز پیاپی" />
        </View>
      </View>

      <ParentButton label="اشتراک‌گذاری" onPress={() => { void share() }} />
      <Text style={styles.hint}>پیام برای واتساپ، تلگرام یا هر اپ دیگری آماده می‌شود</Text>
      </View>
    </ParentPage>
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
  container: { flex: 1, paddingHorizontal: spacing.md + 4, gap: spacing.md + 4 },
  center: { flex: 1, backgroundColor: parentUI.page },
  card: {
    backgroundColor: ramps.brand.soft, borderRadius: radii.lg, padding: spacing.lg,
    borderWidth: 2, borderColor: ramps.brand.bright,
    alignItems: 'center', gap: spacing.xs + 2, marginTop: spacing.sm + 2,
  },
  cardName: { fontSize: 26, fontFamily: fonts.bold, color: ramps.brand.ink, textAlign: 'center' },
  cardLine: { fontSize: textSize.caption + 1, fontFamily: fonts.regular, color: ramps.brand.ink, textAlign: 'center' },
  cardStats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md - 2 },
  cardStat: { alignItems: 'center' },
  cardStatValue: { fontSize: 26, fontFamily: fonts.bold, color: ramps.brand.ink },
  cardStatLabel: { fontSize: textSize.micro + 1, fontFamily: fonts.regular, color: ramps.brand.ink },
  hint: { fontSize: textSize.micro + 1, fontFamily: fonts.regular, color: parentUI.muted, textAlign: 'center' },
})
