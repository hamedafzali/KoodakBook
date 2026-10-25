import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'
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

/* رقم‌های فارسی (ages 6–7) — ported from web /child/math/digits: reading ۴۵۶
 * as 456, both directions. Age 6 → single digits; 7+ → two-digit numbers. */

const ROUNDS = 8
const DONE_TITLE = 'رقم‌شناس شدی!'
// The number being read: 1.6x the display step, with Vazirmatn's own line
// height so the tall Persian digits aren't clipped on Android.
const PROMPT_SIZE = textSize.display * 1.6

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

interface Q { value: number; dir: 'toPersian' | 'toWestern'; options: number[] }

export default function DigitsPage() {
  const [max, setMax] = useState<number | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const childId = await getActiveChildId()
      const res = await api.get<Child[]>('/api/children')
      if (cancelled) return
      const child = res.data?.find((c) => c.id === childId)
      setMax(childAge(child) <= 6 ? 9 : 99)   // 6 → single digits; older → two-digit
    }
    // No child data only means no age band: single digits rather than a
    // spinner forever (a thrown load used to leave it up).
    load().catch(() => { if (!cancelled) setMax(9) })
    return () => { cancelled = true }
  }, [])

  if (max === null) {
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        <ActivityIndicator color={colors.onPrimary} accessibilityLabel="در حال بارگذاری" />
      </ScreenBackground>
    )
  }
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
  const later = useLater()

  useEffect(() => {
    if (!done) sayNumber(q.value)   // hear the number, find it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  // A ref, not `picked`: two taps in one frame both saw picked === null and
  // answered twice (two stars, two advances: a question skipped).
  const answeredRef = useRef(false)
  // Result and finish said once in words (see counting.tsx).
  useEffect(() => {
    if (done) AccessibilityInfo.announceForAccessibility(`${DONE_TITLE} ${toPersianDigits(stars)} ستاره از ${toPersianDigits(ROUNDS)}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function pick(n: number) {
    if (answeredRef.current || picked !== null || done) return
    answeredRef.current = true
    setPicked(n)
    const ok = n === q.value
    AccessibilityInfo.announceForAccessibility(ok ? 'درست!' : `جواب درست ${q.dir === 'toPersian' ? toPersianDigits(q.value) : String(q.value)} بود`)
    if (ok) { setStars((s) => s + 1); sayPhrase('afarin') }
    else sayNumber(q.value)
    later(() => { answeredRef.current = false; setPicked(null); setIdx((i) => i + 1) }, 1200)
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
          sub={`${toPersianDigits(stars)} ستاره از ${toPersianDigits(ROUNDS)} تا`}
        >
          <ClayButton ramp={ramps.math} label="دوباره" emoji="🔁" onPress={onReplay} />
          <ClayButton ramp={ramps.math} tone="soft" label="دنیای اعداد" emoji="🏠" onPress={() => goBack('/math')} />
        </ResultCard>
      </ScreenBackground>
    )
  }

  const prompt = q.dir === 'toPersian' ? String(q.value) : toPersianDigits(q.value)
  const optionLabel = (n: number) => (q.dir === 'toPersian' ? toPersianDigits(n) : String(n))

  return (
    <ScreenBackground variant="warm">
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 92 }]}
    >
      <ScreenHeader
        style={{ paddingHorizontal: 0 }}
        title="رقم‌های فارسی"
        subtitle="۷ همان 7 است!"
        fallback="/math"
        // One star and a count, as in مارپله: a row of up to ROUNDS stars took
        // the title's room at 320pt and wrapped it onto three lines. Hidden
        // at zero but keeping its room (StatChip `hidden`), so the title
        // doesn't re-wrap when the first star arrives.
        right={<StatChip ramp={ramps.math} icon="rewardStar" value={toPersianDigits(stars)} accessibilityLabel={`${toPersianDigits(stars)} ستاره`} hidden={stars === 0} />}
      />

      <RoundTrack ramp={ramps.math} label={`سؤال ${toPersianDigits(idx + 1)} از ${toPersianDigits(ROUNDS)}`} index={idx} total={ROUNDS} />

      <ClaySurface ramp={ramps.math} tone="soft" radius={radii.lg} faceStyle={styles.promptCard}>
        <Text style={styles.promptHint}>
          {q.dir === 'toPersian' ? 'این عدد به رقمِ فارسی کدام است؟' : 'این عدد به رقمِ انگلیسی کدام است؟'}
        </Text>
        <Text style={styles.promptNumber}>{prompt}</Text>
        <Text style={styles.promptWord}>{numberToPersianWord(q.value)}</Text>
      </ClaySurface>

      <View style={styles.options}>
        {q.options.map((n) => (
          <AnswerOption
            key={n}
            state={optionState(n, q.value, picked)}
            isPicked={picked === n}
            main={optionLabel(n)}
            a11yLabel={optionLabel(n)}
            mainStyle={styles.optionNumber}
            onPress={() => pick(n)}
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
  promptCard: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  promptHint: { fontSize: textSize.small, fontFamily: fonts.medium, color: ramps.math.ink, textAlign: 'center' },
  // writingDirection 'ltr' on the numbers is intentional: a two-digit Latin
  // number must read 45, not 54, inside the forced-RTL layout.
  promptNumber: { fontSize: PROMPT_SIZE, lineHeight: naturalLineHeight(PROMPT_SIZE), fontFamily: fonts.bold, color: ramps.math.deep, writingDirection: 'ltr' },
  promptWord: { fontSize: textSize.small, fontFamily: fonts.medium, color: ramps.math.ink },
  options: { flexDirection: 'row', gap: spacing.sm },
  optionNumber: { fontSize: textSize.h1, writingDirection: 'ltr' },
  done: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm + spacing.xs, padding: spacing.lg },
})
