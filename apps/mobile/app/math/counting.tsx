import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { mathAudioUrl, numberToPersianWord, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { playClip } from '@/lib/sound'
import { colors, fonts } from '@/lib/theme'

/* شمارش (ages 3–5) — tap-to-count, ported from web /child/math/counting.
 * The child taps every fruit; each tap speaks the next number («یک… دو…»).
 * When all are counted they answer «چند تا بود؟». Under 5 → up to 5 items. */

const THINGS = ['🍎', '🐤', '🎈', '⭐', '🍓', '🐟', '🌸', '🚗']
const ROUNDS = 5

interface Round { emoji: string; count: number; options: number[] }

const sayNumber = (n: number) => playClip(mathAudioUrl(`n${n}`))
const sayPhrase = (slug: string) => playClip(mathAudioUrl(slug))

function distractors(target: number, n: number, max: number): number[] {
  const out = new Set<number>()
  while (out.size < n) {
    const v = 1 + Math.floor(Math.random() * max)
    if (v !== target) out.add(v)
  }
  return [...out]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function CountingPage() {
  const [maxN, setMaxN] = useState<number | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    async function load() {
      const childId = await getActiveChildId()
      const res = await api.get<Child[]>('/api/children')
      const child = res.data?.find((c) => c.id === childId)
      const age = child?.birth_year ? Math.max(2, new Date().getFullYear() - child.birth_year) : 4
      setMaxN(age <= 4 ? 5 : 10)   // band-appropriate ceiling
    }
    load()
  }, [])

  if (maxN === null) return <View style={styles.center} />
  return <Game key={run} maxN={maxN} onReplay={() => setRun((x) => x + 1)} />
}

function Game({ maxN, onReplay }: { maxN: number; onReplay: () => void }) {
  const insets = useSafeAreaInsets()
  const rounds = useMemo<Round[]>(
    () =>
      Array.from({ length: ROUNDS }, () => {
        const count = 1 + Math.floor(Math.random() * maxN)
        return {
          emoji: THINGS[Math.floor(Math.random() * THINGS.length)],
          count,
          options: shuffle([count, ...distractors(count, 2, maxN + 2)]),
        }
      }),
    [maxN]
  )

  const [idx, setIdx] = useState(0)
  const [tapped, setTapped] = useState<Set<number>>(new Set())
  const [picked, setPicked] = useState<number | null>(null)
  const [stars, setStars] = useState(0)
  const done = idx >= ROUNDS
  const r = rounds[Math.min(idx, ROUNDS - 1)]
  const allCounted = tapped.size === r.count

  function tapItem(i: number) {
    if (tapped.has(i) || allCounted || done) return
    const next = new Set(tapped).add(i)
    setTapped(next)
    sayNumber(next.size)   // the count IS the audio
    if (next.size === r.count) setTimeout(() => sayPhrase('q-chandta'), 900)
  }

  function answer(n: number) {
    if (picked !== null || !allCounted) return
    setPicked(n)
    const ok = n === r.count
    if (ok) { setStars((s) => s + 1); sayPhrase('afarin') }
    else sayNumber(r.count)
    setTimeout(() => { setPicked(null); setTapped(new Set()); setIdx((i) => i + 1) }, 1400)
  }

  if (done) {
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 56 }}>🌟</Text>
        <Text style={styles.doneTitle}>چه شمارشگری! 🌟</Text>
        <Text style={styles.doneSub}>
          {toPersianDigits(stars)} ستاره از {toPersianDigits(ROUNDS)} تا گرفتی
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
          <Text style={styles.title}>شمارش 🍎</Text>
          <Text style={styles.subtitle}>ضربه بزن و بشمار</Text>
        </View>
        <Text style={{ fontSize: 14 }}>{'⭐'.repeat(stars)}</Text>
      </View>

      <Text style={styles.progressLabel}>
        مرحله {toPersianDigits(idx + 1)} از {toPersianDigits(ROUNDS)}
      </Text>

      <View style={styles.stage}>
        <Text style={styles.stageHint}>
          {allCounted ? 'حالا بگو: چند تا بود؟' : 'روی همه ضربه بزن و با من بشمار!'}
        </Text>
        <View style={styles.items}>
          {Array.from({ length: r.count }, (_, i) => (
            <Pressable
              key={i}
              onPress={() => tapItem(i)}
              style={[styles.item, tapped.has(i) && styles.itemTapped]}
            >
              <Text style={{ fontSize: 40 }}>{r.emoji}</Text>
            </Pressable>
          ))}
        </View>
        {tapped.size > 0 && (
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Text style={styles.count}>{toPersianDigits(tapped.size)}</Text>
            <Text style={styles.countWord}>{numberToPersianWord(tapped.size)}</Text>
          </View>
        )}
      </View>

      <View style={[styles.options, !allCounted && { opacity: 0.3 }]}>
        {r.options.map((n) => {
          const show = picked !== null
          const bg = show
            ? n === r.count ? styles.optionRight : n === picked ? styles.optionWrong : undefined
            : undefined
          return (
            <Pressable key={n} onPress={() => answer(n)} disabled={!allCounted} style={[styles.option, bg]}>
              <Text style={styles.optionNumber}>{toPersianDigits(n)}</Text>
              <Text style={styles.optionWord}>{numberToPersianWord(n)}</Text>
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
  stage: { backgroundColor: colors.card, borderRadius: 20, padding: 18, minHeight: 220 },
  stageHint: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', marginBottom: 14 },
  items: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  item: {
    width: 64, height: 64, borderRadius: 18, backgroundColor: '#ecfdf5',
    alignItems: 'center', justifyContent: 'center',
  },
  itemTapped: { backgroundColor: '#a7f3d0', transform: [{ scale: 1.08 }] },
  count: { fontSize: 40, fontFamily: fonts.bold, color: '#059669' },
  countWord: { fontSize: 15, fontFamily: fonts.regular, color: '#10b981' },
  options: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb',
    paddingVertical: 16, alignItems: 'center', gap: 2,
  },
  optionRight: { backgroundColor: '#dcfce7', borderColor: colors.success },
  optionWrong: { backgroundColor: '#fee2e2', borderColor: colors.danger },
  optionNumber: { fontSize: 28, fontFamily: fonts.bold, color: colors.text },
  optionWord: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
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
