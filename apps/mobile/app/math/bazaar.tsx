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
import SceneBackdrop from '@/components/SceneBackdrop'
import ScreenBackground from '@/components/ScreenBackground'
import { CharacterArt, ClayButton, ClaySurface } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { RESULT_ART, ResultCard, RoundTrack, StatChip } from '@/components/GameKit'
import { answerRamps, clay, colors, fonts, naturalLineHeight, radii, ramps, spacing, textSize, tones, type Ramp } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import BottomNav from '@/components/BottomNav'

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
const DONE_TITLE = 'چه خریدار زرنگی!'

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
    let cancelled = false
    async function load() {
      const childId = await getActiveChildId()
      const res = await api.get<Child[]>('/api/children')
      if (cancelled) return
      const child = res.data?.find((c) => c.id === childId)
      setMode(childAge(child) <= 8 ? 'read' : 'sum')   // 8 reads prices; 9–10 adds them
    }
    // No child data only means no age band: read prices (the easier mode)
    // rather than a spinner forever (a thrown load used to leave it up).
    load().catch(() => { if (!cancelled) setMode('read') })
    return () => { cancelled = true }
  }, [])

  if (!mode) {
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        <ActivityIndicator color={colors.onPrimary} accessibilityLabel="در حال بارگذاری" />
      </ScreenBackground>
    )
  }
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
  const later = useLater()

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
    const ok = n === q.answer
    AccessibilityInfo.announceForAccessibility(ok ? 'درست!' : `جواب درست ${toPersianDigits(q.answer)} تومان بود`)
    if (ok) { setStars((s) => s + 1); sayPhrase('afarin') }
    else sayNumber(q.answer)
    later(() => { answeredRef.current = false; setPicked(null); setIdx((i) => i + 1) }, 1500)
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
          sub={`${toPersianDigits(stars)} ستاره از ${toPersianDigits(ROUNDS)} خرید`}
        >
          <ClayButton ramp={ramps.math} label="دوباره" emoji="🔁" onPress={onReplay} />
          <ClayButton ramp={ramps.math} tone="soft" label="دنیای اعداد" emoji="🏠" onPress={() => goBack('/math')} />
        </ResultCard>
      </ScreenBackground>
    )
  }

  const names = q.targets.map((t) => q.items[t].name)

  return (
    <ScreenBackground variant="warm">
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 92 }]}
    >
      <ScreenHeader
        style={{ paddingHorizontal: 0 }}
        title="بازار"
        titleEmoji="🛒"
        subtitle="با تومان خرید کن"
        fallback="/math"
        // One star and a count, as in مارپله: a row of up to ROUNDS stars took
        // the title's room at 320pt and wrapped it onto three lines. Hidden
        // at zero but keeping its room (StatChip `hidden`), so the title
        // doesn't re-wrap when the first star arrives.
        right={<StatChip ramp={ramps.math} icon="rewardStar" value={toPersianDigits(stars)} accessibilityLabel={`${toPersianDigits(stars)} ستاره`} hidden={stars === 0} />}
      />

      <RoundTrack ramp={ramps.math} label={`خرید ${toPersianDigits(idx + 1)} از ${toPersianDigits(ROUNDS)}`} index={idx} total={ROUNDS} />

      {/* The stall, over an illustrated bazaar backdrop -- was a plain white
          row on the one math screen most suited to a scene (audit UI Low #12;
          mobile already ships this exact SceneBackdrop for the story reader). */}
      <View style={styles.stallScene}>
        <SceneBackdrop scene="bazaar" style={StyleSheet.absoluteFill} />
        <View style={styles.stall}>
          {q.items.map((it, i) => (
            // One stop per item for a screen reader: its name and price, not
            // the emoji's English name and two separate texts.
            <View key={i} accessible accessibilityLabel={`${it.name}، ${toPersianDigits(it.price)} تومان`} style={[styles.good, q.targets.includes(i) && picked === null && styles.goodTarget]}>
              <Text style={styles.goodEmoji}>{it.emoji}</Text>
              <Text style={styles.goodName}>{it.name}</Text>
              <Text style={styles.goodPrice}>{toPersianDigits(it.price)} تومان</Text>
            </View>
          ))}
        </View>
      </View>

      <ClaySurface ramp={ramps.math} tone="soft" radius={radii.md} edge={clay.edgeSm} faceStyle={styles.questionFace}>
        <Text style={styles.questionText}>
          {q.mode === 'read'
            ? `${names[0]} چند تومان است؟`
            : `یک ${names[0]} و یک ${names[1]} — روی هم چند تومان می‌شود؟`}
        </Text>
      </ClaySurface>

      <View style={styles.options}>
        {q.options.map((n) => (
          <AnswerOption
            key={n}
            state={optionState(n, q.answer, picked)}
            isPicked={picked === n}
            main={toPersianDigits(n)}
            sub={`تومان — ${numberToPersianWord(n)}`}
            a11yLabel={`${toPersianDigits(n)} تومان`}
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
  stallScene: { borderRadius: radii.md, overflow: 'hidden', padding: spacing.sm + 2 },
  stall: { flexDirection: 'row', gap: spacing.sm },
  // padding sm (not 10) + minWidth 0: at 320pt each stall card has ~84pt, and
  // «۹۰ تومان» at the caption size wraps inside it instead of widening it.
  good: {
    flex: 1, minWidth: 0, backgroundColor: colors.card, borderRadius: radii.sm, padding: spacing.sm,
    alignItems: 'center', gap: 2, borderWidth: 2, borderColor: 'transparent',
  },
  goodEmoji: { fontSize: textSize.h1 },
  // The items the question names; the question text names them too. Math's
  // deep stop (>= 3:1 on white): brand bright was a 1.7:1 rim.
  goodTarget: { borderColor: ramps.math.deep, borderWidth: 3 },
  // Caption size (was 12/13). Both colours measured on the white card: muted
  // ~5.2:1; the price is tones.amber.edge, the same #B45309 it was typed as
  // (~5.0:1), now a token.
  goodName: { fontSize: textSize.caption, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  goodPrice: { fontSize: textSize.caption, fontFamily: fonts.bold, color: tones.amber.edge, textAlign: 'center' },
  questionFace: { padding: spacing.md - 2 },
  questionText: { fontSize: textSize.small, fontFamily: fonts.bold, color: ramps.math.ink, textAlign: 'center', lineHeight: naturalLineHeight(textSize.small) },
  options: { flexDirection: 'row', gap: spacing.sm },
  optionNumber: { fontSize: textSize.h2 },
  done: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm + spacing.xs, padding: spacing.lg },
})
