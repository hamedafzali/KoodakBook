import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { numberToPersianWord, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { childAge, distractors, sayNumber, sayPhrase, shuffle } from '@/lib/math'
import CelebrationOverlay from '@/components/CelebrationOverlay'
import ScreenBackground from '@/components/ScreenBackground'
import { CharacterArt, ClayButton, ClaySurface } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { RESULT_ART, ResultCard, RoundTrack, StatChip } from '@/components/GameKit'
import { answerRamps, colors, fonts, naturalLineHeight, radii, ramps, spacing, textSize, type Ramp } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import BottomNav from '@/components/BottomNav'

/* شمارش (ages 3–5) — tap-to-count, ported from web /child/math/counting.
 * The child taps every fruit; each tap speaks the next number («یک… دو…»).
 * When all are counted they answer «چند تا بود؟». Under 5 → up to 5 items. */

const THINGS = ['🍎', '🐤', '🎈', '⭐', '🍓', '🐟', '🌸', '🚗']
const ROUNDS = 5
const DONE_TITLE = 'چه شمارشگری!'

/* ── Answer option (2026-09-25 convergence pass) ─────────────────────────────
 * Clay in the math ramp, pressed like every other clay control. Once an answer
 * is picked the right option turns to green clay and a wrong pick to rose
 * clay, each with a ✅/❌ mark and a spoken «درست»/«نادرست»/«جواب درست»
 * (QuizCard's OptionGrid wording), so the result never rests on colour alone;
 * the other options fade. Before answering the label is only the option
 * itself, so nothing gives the answer away. */
type OptionState = 'idle' | 'right' | 'wrong' | 'dim'
// The shared quiz answer pair (theme.ts answerRamps, the same green/rose every
// child quiz uses); this file used to assemble its own identical rose ramp.
const OPTION_LOOK: Record<OptionState, { ramp: Ramp; tone: 'bright' | 'soft' }> = {
  idle: { ramp: ramps.math, tone: 'soft' },
  dim: { ramp: ramps.math, tone: 'soft' },
  right: { ramp: answerRamps.right, tone: 'bright' },
  wrong: { ramp: answerRamps.wrong, tone: 'soft' },
}

function optionState(n: number, answer: number, picked: number | null): OptionState {
  if (picked === null) return 'idle'
  if (n === answer) return 'right'
  return n === picked ? 'wrong' : 'dim'
}

function AnswerOption({ state, isPicked, main, sub, a11yLabel, mainStyle, disabled = false, onPress }: {
  state: OptionState
  isPicked: boolean
  main: string
  sub?: string
  a11yLabel: string
  mainStyle?: StyleProp<TextStyle>
  disabled?: boolean
  onPress: () => void
}) {
  const look = OPTION_LOOK[state]
  const locked = disabled || state !== 'idle'
  const result = state === 'right' ? (isPicked ? '، درست' : '، جواب درست') : state === 'wrong' ? '، نادرست' : ''
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={`${a11yLabel}${result}`}
      accessibilityState={{ disabled: locked, selected: isPicked }}
      style={[optionStyles.slot, state === 'dim' && optionStyles.dim]}
    >
      {({ pressed }) => (
        <ClaySurface ramp={look.ramp} tone={look.tone} pressed={pressed && !locked} radius={radii.md} style={optionStyles.fill} faceStyle={optionStyles.face}>
          <Text style={[optionStyles.main, { color: look.ramp.ink }, mainStyle]}>{main}</Text>
          {sub ? <Text style={[optionStyles.sub, { color: look.ramp.ink }]}>{sub}</Text> : null}
          {/* Always takes its line, so marking the result doesn't resize the
              row. A drawn ✓ / ✗ in a white disc (was ✅/❌ emoji); the
              result is also in the spoken label. */}
          <View style={optionStyles.mark}>
            {state === 'right' || state === 'wrong' ? (
              <View style={[optionStyles.markDisc, { borderColor: look.ramp.bright }]}>
                <Icon name={state === 'right' ? 'check' : 'close'} color={look.ramp.ink} size={14} strokeWidth={3} />
              </View>
            ) : null}
          </View>
        </ClaySurface>
      )}
    </Pressable>
  )
}

const optionStyles = StyleSheet.create({
  slot: { flex: 1 },
  dim: { opacity: 0.5 },
  fill: { flex: 1 },
  face: { flex: 1, minHeight: 88, paddingTop: spacing.sm + spacing.xs, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center', gap: 2 },
  main: { fontFamily: fonts.bold, fontSize: textSize.h1, textAlign: 'center' },
  sub: { fontFamily: fonts.medium, fontSize: textSize.micro, textAlign: 'center' },
  mark: { height: 26, alignItems: 'center', justifyContent: 'center' },
  markDisc: {
    width: 24, height: 24, borderRadius: radii.pill, borderWidth: 2, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
})

/** Clears every pending feedback timer when the game unmounts (leaving mid-
 *  feedback used to advance a round, and speak, on an unmounted screen). */
function useLater() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = [] }, [])
  return (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }
}

interface Round { emoji: string; count: number; options: number[] }

// Quick bounce + wiggle on tap, replacing the old static scale(1.08) -- makes
// a tap feel like it landed instead of just changing color (2026-09-20
// audit, UI High #7).
function CountItem({ emoji, tapped, onPress }: { emoji: string; tapped: boolean; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!tapped) return
    anim.setValue(0)
    const bounce = Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(anim, { toValue: 0, friction: 3, useNativeDriver: true }),
    ])
    bounce.start()
    // The next round unmounts these items mid-spring; stop it with them.
    return () => bounce.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapped])
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] })
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] })
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tapped ? 'شمرده شد' : 'بشمار'} accessibilityState={{ disabled: tapped }} onPress={onPress} disabled={tapped}>
      <Animated.View style={[styles.item, tapped && styles.itemTapped, { transform: [{ scale }, { rotate }] }]}>
        {/* Fixed size: the thing being counted fills its 64pt tile; scaled
            with the system text size it overflowed the tile. */}
        <Text style={styles.itemEmoji} allowFontScaling={false}>{emoji}</Text>
      </Animated.View>
    </Pressable>
  )
}

export default function CountingPage() {
  const [maxN, setMaxN] = useState<number | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const childId = await getActiveChildId()
      const res = await api.get<Child[]>('/api/children')
      if (cancelled) return
      const child = res.data?.find((c) => c.id === childId)
      setMaxN(childAge(child) <= 4 ? 5 : 10)   // band-appropriate ceiling
    }
    // No child data only means no age band: play the younger ceiling rather
    // than leave the spinner up (a thrown load used to do exactly that).
    load().catch(() => { if (!cancelled) setMaxN(5) })
    return () => { cancelled = true }
  }, [])

  if (maxN === null) {
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        <ActivityIndicator color={colors.onPrimary} accessibilityLabel="در حال بارگذاری" />
      </ScreenBackground>
    )
  }
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
  const later = useLater()
  // Taps and answers read these refs, not the render's state: two taps in
  // one frame both saw the old state, so an item's count was dropped, or a
  // round was answered twice (two stars, two advances: a round skipped).
  const tappedRef = useRef<Set<number>>(new Set())
  const answeredRef = useRef(false)

  function tapItem(i: number) {
    const cur = tappedRef.current
    if (cur.has(i) || cur.size >= r.count || done) return
    const next = new Set(cur).add(i)
    tappedRef.current = next
    setTapped(next)
    sayNumber(next.size)   // the count IS the audio
    if (next.size === r.count) later(() => sayPhrase('q-chandta'), 900)
  }

  // The result and the finish are said once, in words, for a screen reader:
  // the option's own label changes too, but focus doesn't move to hear it,
  // and the audio clips can be missing (lib/math.ts: no TTS fallback).
  useEffect(() => {
    if (done) AccessibilityInfo.announceForAccessibility(`${DONE_TITLE} ${toPersianDigits(stars)} ستاره از ${toPersianDigits(ROUNDS)}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function answer(n: number) {
    if (answeredRef.current || picked !== null || !allCounted) return
    answeredRef.current = true
    setPicked(n)
    const ok = n === r.count
    AccessibilityInfo.announceForAccessibility(ok ? 'درست!' : `جواب درست ${toPersianDigits(r.count)} بود`)
    if (ok) { setStars((s) => s + 1); sayPhrase('afarin') }
    else sayNumber(r.count)
    later(() => {
      answeredRef.current = false
      tappedRef.current = new Set()
      setPicked(null); setTapped(new Set()); setIdx((i) => i + 1)
    }, 1400)
  }

  if (done) {
    return (
      <ScreenBackground variant="warm" style={styles.done}>
        <CelebrationOverlay />
        {/* The shared finish card (GameKit): خرسی, math's host, over the
            room's sunburst, and the stars earned out of the rounds. */}
        <ResultCard
          ramp={ramps.math}
          art={<CharacterArt character="khersi" emotion="proud" size={RESULT_ART} />}
          title={DONE_TITLE}
          stars={stars}
          total={ROUNDS}
          sub={`${toPersianDigits(stars)} ستاره از ${toPersianDigits(ROUNDS)} تا گرفتی`}
        >
          <ClayButton ramp={ramps.math} label="دوباره" emoji="🔁" onPress={onReplay} />
          <ClayButton ramp={ramps.math} tone="soft" label="دنیای اعداد" emoji="🏠" onPress={() => goBack('/math')} />
        </ResultCard>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 92 }]}
    >
      <ScreenHeader
        style={{ paddingHorizontal: 0 }}
        title="شمارش"
        titleEmoji="🍎"
        subtitle="ضربه بزن و بشمار"
        fallback="/math"
        // One star and a count, as in مارپله: a row of up to ROUNDS stars took
        // the title's room at 320pt and wrapped it onto three lines. Hidden
        // at zero but keeping its room (StatChip `hidden`), so the title
        // doesn't re-wrap when the first star arrives.
        right={<StatChip ramp={ramps.math} icon="rewardStar" value={toPersianDigits(stars)} accessibilityLabel={`${toPersianDigits(stars)} ستاره`} hidden={stars === 0} />}
      />

      <RoundTrack ramp={ramps.math} label={`مرحله ${toPersianDigits(idx + 1)} از ${toPersianDigits(ROUNDS)}`} index={idx} total={ROUNDS} />

      <ClaySurface ramp={ramps.math} tone="soft" radius={radii.lg} faceStyle={styles.stage}>
        <Text style={styles.stageHint}>
          {allCounted ? 'حالا بگو: چند تا بود؟' : 'روی همه ضربه بزن و با من بشمار!'}
        </Text>
        <View style={styles.items}>
          {Array.from({ length: r.count }, (_, i) => (
            <CountItem key={i} emoji={r.emoji} tapped={tapped.has(i)} onPress={() => tapItem(i)} />
          ))}
        </View>
        {tapped.size > 0 && (
          <View style={styles.countBlock}>
            <Text style={styles.count}>{toPersianDigits(tapped.size)}</Text>
            <Text style={styles.countWord}>{numberToPersianWord(tapped.size)}</Text>
          </View>
        )}
      </ClaySurface>

      <View style={[styles.options, !allCounted && { opacity: 0.3 }]}>
        {r.options.map((n) => (
          <AnswerOption
            key={n}
            state={optionState(n, r.count, picked)}
            isPicked={picked === n}
            main={toPersianDigits(n)}
            sub={numberToPersianWord(n)}
            a11yLabel={toPersianDigits(n)}
            disabled={!allCounted}
            onPress={() => answer(n)}
          />
        ))}
      </View>
    </ScrollView>
    <BottomNav />
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, gap: spacing.md - 2 },
  // Padding clears the tap bounce (scale 1.28 on 64pt = ~9pt each side):
  // the clay face clips its children.
  stage: { padding: spacing.md, minHeight: 220 },
  stageHint: { fontSize: textSize.small, fontFamily: fonts.medium, color: ramps.math.ink, textAlign: 'center', marginBottom: spacing.sm + spacing.xs },
  items: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm + spacing.xs },
  item: {
    width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.card,
    borderWidth: 2, borderColor: ramps.math.bright,
    alignItems: 'center', justifyContent: 'center',
  },
  // Counted: filled AND a heavier deep rim, so it isn't a colour change alone.
  itemTapped: { backgroundColor: ramps.math.bright, borderColor: ramps.math.deep, borderWidth: 4 },
  itemEmoji: { fontSize: textSize.display },
  countBlock: { alignItems: 'center', marginTop: spacing.sm },
  count: { fontSize: textSize.display, lineHeight: naturalLineHeight(textSize.display), fontFamily: fonts.bold, color: ramps.math.deep },
  countWord: { fontSize: textSize.small, fontFamily: fonts.medium, color: ramps.math.ink },
  options: { flexDirection: 'row', gap: spacing.sm },
  done: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm + spacing.xs, padding: spacing.lg },
})
