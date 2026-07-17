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

/* بازار (ages 8–10) — ported from web /child/math/bazaar: reading price tags
 * in Persian digits and paying in تومان. Age 8 → read a price; 9–10 → add two
 * («روی هم چند تومان می‌شود؟»). Web speaks the question via browser TTS; on
 * mobile the question stays on screen (no TTS), answers still get audio. */

const GOODS = [
  { emoji: '🍎', name: 'سیب' }, { emoji: '🍌', name: 'موز' }, { emoji: '🥕', name: 'هویج' },
  { emoji: '🍇', name: 'انگور' }, { emoji: '🍞', name: 'نان' }, { emoji: '🧀', name: 'پنیر' },
  { emoji: '🍉', name: 'هندوانه' }, { emoji: '🍪', name: 'شیرینی' },
]
const ROUNDS = 6

interface StallItem { emoji: string; name: string; price: number }
interface Q { items: StallItem[]; mode: 'read' | 'sum'; targets: number[]; answer: number; options: number[] }

function makeQuestion(mode: 'read' | 'sum'): Q {
  const picked = shuffle(GOODS).slice(0, 3)
  const items = picked.map((g) => ({ ...g, price: (1 + Math.floor(Math.random() * 9)) * 10 }))  // 10–90 toman, round
  if (mode === 'read') {
    const t = Math.floor(Math.random() * items.length)
    const answer = items[t].price
    return { items, mode, targets: [t], answer, options: shuffle([answer, ...distractors(answer / 10, 2, 9).map((d) => d * 10)]) }
  }
  const [a, b] = shuffle([0, 1, 2]).slice(0, 2)
  const answer = items[a].price + items[b].price
  const wrong = distractors(answer / 10, 2, 19).map((d) => d * 10)
  return { items, mode, targets: [a, b], answer, options: shuffle([answer, ...wrong]) }
}

export default function BazaarPage() {
  const [mode, setMode] = useState<'read' | 'sum' | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    async function load() {
      const childId = await getActiveChildId()
      const res = await api.get<Child[]>('/api/children')
      const child = res.data?.find((c) => c.id === childId)
      setMode(childAge(child) <= 8 ? 'read' : 'sum')   // 8 reads prices; 9–10 adds them
    }
    load()
  }, [])

  if (!mode) return <View style={styles.center} />
  return <Game key={run} mode={mode} onReplay={() => setRun((x) => x + 1)} />
}

function Game({ mode, onReplay }: { mode: 'read' | 'sum'; onReplay: () => void }) {
  const insets = useSafeAreaInsets()
  const questions = useMemo<Q[]>(() => Array.from({ length: ROUNDS }, () => makeQuestion(mode)), [mode])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [stars, setStars] = useState(0)
  const done = idx >= ROUNDS
  const q = questions[Math.min(idx, ROUNDS - 1)]

  function pick(n: number) {
    if (picked !== null || done) return
    setPicked(n)
    const ok = n === q.answer
    if (ok) { setStars((s) => s + 1); sayPhrase('afarin') }
    else sayNumber(q.answer)
    setTimeout(() => { setPicked(null); setIdx((i) => i + 1) }, 1500)
  }

  if (done) {
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 56 }}>🛒</Text>
        <Text style={styles.doneTitle}>چه خریدار زرنگی! 🛒</Text>
        <Text style={styles.doneSub}>
          {toPersianDigits(stars)} ستاره از {toPersianDigits(ROUNDS)} خرید
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

  const names = q.targets.map((t) => q.items[t].name)

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
          <Text style={styles.title}>بازار 🛒</Text>
          <Text style={styles.subtitle}>با تومان خرید کن</Text>
        </View>
        <Text style={{ fontSize: 14 }}>{'⭐'.repeat(stars)}</Text>
      </View>

      <Text style={styles.progressLabel}>
        خرید {toPersianDigits(idx + 1)} از {toPersianDigits(ROUNDS)}
      </Text>

      {/* The stall */}
      <View style={styles.stall}>
        {q.items.map((it, i) => (
          <View key={i} style={[styles.good, q.targets.includes(i) && picked === null && styles.goodTarget]}>
            <Text style={{ fontSize: 30 }}>{it.emoji}</Text>
            <Text style={styles.goodName}>{it.name}</Text>
            <Text style={styles.goodPrice}>{toPersianDigits(it.price)} تومان</Text>
          </View>
        ))}
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionText}>
          {q.mode === 'read'
            ? `${names[0]} چند تومان است؟`
            : `یک ${names[0]} و یک ${names[1]} — روی هم چند تومان می‌شود؟`}
        </Text>
      </View>

      <View style={styles.options}>
        {q.options.map((n) => {
          const show = picked !== null
          const bg = show
            ? n === q.answer ? styles.optionRight : n === picked ? styles.optionWrong : undefined
            : undefined
          return (
            <Pressable key={n} onPress={() => pick(n)} style={[styles.option, bg]}>
              <Text style={styles.optionNumber}>{toPersianDigits(n)}</Text>
              <Text style={styles.optionUnit}>تومان — {numberToPersianWord(n)}</Text>
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
  stall: { flexDirection: 'row', gap: 8 },
  good: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 10,
    alignItems: 'center', gap: 2, borderWidth: 2, borderColor: 'transparent',
  },
  goodTarget: { borderColor: '#f59e0b' },
  goodName: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  goodPrice: { fontSize: 13, fontFamily: fonts.bold, color: '#b45309' },
  questionCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14 },
  questionText: { fontSize: 15, fontFamily: fonts.bold, color: colors.text, textAlign: 'center', lineHeight: 26 },
  options: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb',
    paddingVertical: 14, alignItems: 'center', gap: 2,
  },
  optionRight: { backgroundColor: '#dcfce7', borderColor: colors.success },
  optionWrong: { backgroundColor: '#fee2e2', borderColor: colors.danger },
  optionNumber: { fontSize: 24, fontFamily: fonts.bold, color: colors.text },
  optionUnit: { fontSize: 10, fontFamily: fonts.regular, color: colors.muted },
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
