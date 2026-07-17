import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { numberToPersianWord, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { childAge, distractors, sayNumber, sayPhrase, shuffle } from '@/lib/math'
import { colors, fonts } from '@/lib/theme'

/* رقم‌های فارسی (ages 6–7) — ported from web /child/math/digits: reading ۴۵۶
 * as 456, both directions. Age 6 → single digits; 7+ → two-digit numbers. */

const ROUNDS = 8

interface Q { value: number; dir: 'toPersian' | 'toWestern'; options: number[] }

export default function DigitsPage() {
  const [max, setMax] = useState<number | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    async function load() {
      const childId = await getActiveChildId()
      const res = await api.get<Child[]>('/api/children')
      const child = res.data?.find((c) => c.id === childId)
      setMax(childAge(child) <= 6 ? 9 : 99)   // 6 → single digits; older → two-digit
    }
    load()
  }, [])

  if (max === null) return <View style={styles.center} />
  return <Game key={run} max={max} onReplay={() => setRun((x) => x + 1)} />
}

function Game({ max, onReplay }: { max: number; onReplay: () => void }) {
  const insets = useSafeAreaInsets()
  const questions = useMemo<Q[]>(
    () =>
      Array.from({ length: ROUNDS }, (_, i) => {
        const value = Math.floor(Math.random() * (max + 1))
        return {
          value,
          dir: i % 2 === 0 ? ('toPersian' as const) : ('toWestern' as const),
          options: shuffle([value, ...distractors(value, 2, max)]),
        }
      }),
    [max]
  )

  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [stars, setStars] = useState(0)
  const done = idx >= ROUNDS
  const q = questions[Math.min(idx, ROUNDS - 1)]

  useEffect(() => {
    if (!done) sayNumber(q.value)   // hear the number, find it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  function pick(n: number) {
    if (picked !== null || done) return
    setPicked(n)
    const ok = n === q.value
    if (ok) { setStars((s) => s + 1); sayPhrase('afarin') }
    else sayNumber(q.value)
    setTimeout(() => { setPicked(null); setIdx((i) => i + 1) }, 1200)
  }

  if (done) {
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 56 }}>🔢</Text>
        <Text style={styles.doneTitle}>رقم‌شناس شدی! 🔢</Text>
        <Text style={styles.doneSub}>
          {toPersianDigits(stars)} ستاره از {toPersianDigits(ROUNDS)} تا
        </Text>
        <Pressable style={styles.primaryButton} onPress={onReplay}>
          <Text style={styles.primaryText}>دوباره 🔁</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>دنیای اعداد 🏠</Text>
        </Pressable>
      </View>
    )
  }

  const prompt = q.dir === 'toPersian' ? String(q.value) : toPersianDigits(q.value)
  const optionLabel = (n: number) => (q.dir === 'toPersian' ? toPersianDigits(n) : String(n))

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
          <Text style={styles.title}>رقم‌های فارسی ۱۲۳</Text>
          <Text style={styles.subtitle}>۷ همان 7 است!</Text>
        </View>
        <Text style={{ fontSize: 14 }}>{'⭐'.repeat(stars)}</Text>
      </View>

      <Text style={styles.progressLabel}>
        سؤال {toPersianDigits(idx + 1)} از {toPersianDigits(ROUNDS)}
      </Text>

      <View style={styles.promptCard}>
        <Text style={styles.promptHint}>
          {q.dir === 'toPersian' ? 'این عدد به رقمِ فارسی کدام است؟' : 'این عدد به رقمِ انگلیسی کدام است؟'}
        </Text>
        <Text style={styles.promptNumber}>{prompt}</Text>
        <Text style={styles.promptWord}>{numberToPersianWord(q.value)}</Text>
      </View>

      <View style={styles.options}>
        {q.options.map((n) => {
          const show = picked !== null
          const bg = show
            ? n === q.value ? styles.optionRight : n === picked ? styles.optionWrong : undefined
            : undefined
          return (
            <Pressable key={n} onPress={() => pick(n)} style={[styles.option, bg]}>
              <Text style={styles.optionNumber}>{optionLabel(n)}</Text>
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  progressLabel: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted },
  promptCard: { backgroundColor: colors.card, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 },
  promptHint: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted },
  promptNumber: { fontSize: 64, fontFamily: fonts.bold, color: '#0284c7', writingDirection: 'ltr' },
  promptWord: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted },
  options: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb',
    paddingVertical: 22, alignItems: 'center',
  },
  optionRight: { backgroundColor: '#dcfce7', borderColor: colors.success },
  optionWrong: { backgroundColor: '#fee2e2', borderColor: colors.danger },
  optionNumber: { fontSize: 32, fontFamily: fonts.bold, color: colors.text, writingDirection: 'ltr' },
  doneTitle: { fontSize: 26, fontFamily: fonts.bold, color: colors.text },
  doneSub: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted },
  primaryButton: {
    marginTop: 10, backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 60,
  },
  primaryText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  secondaryButton: {
    borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 40,
  },
  secondaryText: { color: colors.muted, fontSize: 15, fontFamily: fonts.bold },
})
