import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { numberToPersianWord, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { childAge, distractors, sayNumber, sayPhrase, shuffle } from '@/lib/math'
import CelebrationOverlay from '@/components/CelebrationOverlay'
import { colors, fonts } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import BottomNav from '@/components/BottomNav'

/* شمارش (ages 3–5) — tap-to-count, ported from web /child/math/counting.
 * The child taps every fruit; each tap speaks the next number («یک… دو…»).
 * When all are counted they answer «چند تا بود؟». Under 5 → up to 5 items. */

const THINGS = ['🍎', '🐤', '🎈', '⭐', '🍓', '🐟', '🌸', '🚗']
const ROUNDS = 5

interface Round { emoji: string; count: number; options: number[] }

// Quick bounce + wiggle on tap, replacing the old static scale(1.08) -- makes
// a tap feel like it landed instead of just changing color (2026-09-20
// audit, UI High #7).
function CountItem({ emoji, tapped, onPress }: { emoji: string; tapped: boolean; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!tapped) return
    anim.setValue(0)
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(anim, { toValue: 0, friction: 3, useNativeDriver: true }),
    ]).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapped])
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] })
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] })
  return (
    <Pressable onPress={onPress} disabled={tapped}>
      <Animated.View style={[styles.item, tapped && styles.itemTapped, { transform: [{ scale }, { rotate }] }]}>
        <Text style={{ fontSize: 40 }}>{emoji}</Text>
      </Animated.View>
    </Pressable>
  )
}

export default function CountingPage() {
  const [maxN, setMaxN] = useState<number | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    async function load() {
      const childId = await getActiveChildId()
      const res = await api.get<Child[]>('/api/children')
      const child = res.data?.find((c) => c.id === childId)
      setMaxN(childAge(child) <= 4 ? 5 : 10)   // band-appropriate ceiling
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
        <CelebrationOverlay />
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
    <View style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 92 }]}
    >
      <ScreenHeader
        title="شمارش 🍎"
        subtitle="ضربه بزن و بشمار"
        right={<Text style={{ fontSize: 14 }}>{'⭐'.repeat(stars)}</Text>}
      />

      <Text style={styles.progressLabel}>
        مرحله {toPersianDigits(idx + 1)} از {toPersianDigits(ROUNDS)}
      </Text>

      <View style={styles.stage}>
        <Text style={styles.stageHint}>
          {allCounted ? 'حالا بگو: چند تا بود؟' : 'روی همه ضربه بزن و با من بشمار!'}
        </Text>
        <View style={styles.items}>
          {Array.from({ length: r.count }, (_, i) => (
            <CountItem key={i} emoji={r.emoji} tapped={tapped.has(i)} onPress={() => tapItem(i)} />
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
    <BottomNav />
    </View>
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
  itemTapped: { backgroundColor: '#a7f3d0' },
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
  doneTitle: { fontSize: 26, fontFamily: fonts.display, color: colors.text },
  doneSub: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted },
  primaryButton: {
    marginTop: 10, backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 60,
  },
  primaryText: { color: colors.onPrimary, fontSize: 17, fontFamily: fonts.bold },
  secondaryButton: {
    borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 40,
  },
  secondaryText: { color: colors.muted, fontSize: 15, fontFamily: fonts.bold },
})
