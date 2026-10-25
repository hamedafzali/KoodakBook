import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, PlacementProbe, ProbeChoice, ProbeResults, ProbeStep } from '@koodakbook/shared'
import { wordEmoji, currentProbeStep, recordProbeAnswer, emptyProbeResults } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { playClip, stopClip } from '@/lib/sound'
import ScreenBackground from '@/components/ScreenBackground'
import LoadState from '@/components/LoadState'
import { goBack } from '@/lib/navigation'
import { CharacterArt, ClayButton, ClaySurface, TextButton } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { HostPrompt } from '@/components/QuizCard'
import { RoomDoneCard } from '@/components/RoomScene'
import { colors, fonts, naturalLineHeight, radii, ramps, spacing, textSize } from '@/lib/theme'

/**
 * Placement probe (web: /onboarding/placement) — a short adaptive game that
 * sets the child's starting level. Simorgh greets, then a one-step staircase
 * per strand (V/D/F branch harder/easier off their first item; C stays a
 * single item) — see docs/placement-probe-rebuild.md. Web speaks Simorgh's
 * line via browser TTS; mobile shows it as text (listen-questions still play
 * their audio clip).
 *
 * The fixed 4-question array is gone: the server sends an item BANK (a mid
 * item per strand plus its hard/easy branch candidates), and
 * `@koodakbook/shared`'s probeFlow walks it strand-by-strand as answers come
 * in — the exact same logic web uses, so the branch rule and the "skip a
 * strand with no content" rule can't diverge between the two clients.
 *
 * `?mode=reprobe` runs the same screen as periodic re-placement instead of
 * onboarding (docs/re-placement-flow-design.md §2) — a skippable game card
 * on the home screen, not a forced first-run step. Onboarding and reprobe now
 * progress identically item-by-item (§6 of the probe rebuild doc retired the
 * old "abort the whole probe at the first miss" behaviour for both flows —
 * a branch to an easier item is still forward motion, never a stop). What
 * still differs, all here in the client: it never reveals the resulting
 * level on reprobe (a recurring scorecard is exactly the signal the
 * gate/trophy split otherwise protects), and it posts to reprobe-result,
 * which only ever refreshes the decaying prior — it never writes the gate
 * directly.
 */
type Phase = 'loading' | 'intro' | 'question' | 'feedback' | 'done'

function choiceFace(c: ProbeChoice): string {
  if (c.kind === 'letter') return c.character ?? c.persian
  return wordEmoji(c.english ?? '') ?? c.persian
}

const LEVEL_LABELS = ['', 'تازه‌کار', 'آشنا با کلمه‌ها', 'خواننده‌ی کوچک', 'خواننده‌ی ماهر']

// GET /api/placement/probe answers 503 with exactly this error when no strand
// has a usable item (apps/backend/src/routes/placement.ts, `usable` check).
// ApiResponse carries no status code, so the message is the only signal that
// the probe is empty rather than unreachable. If the backend's wording
// changes, this falls back to LoadState's retry (stuck, but no loop).
const NO_PROBE_CONTENT = 'Not enough content to build a placement probe'

export default function Placement() {
  const insets = useSafeAreaInsets()
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const isReprobe = mode === 'reprobe'
  const [child, setChild] = useState<Child | null>(null)
  const [bank, setBank] = useState<PlacementProbe | null>(null)
  const [results, setResults] = useState<ProbeResults>(emptyProbeResults())
  const [phase, setPhase] = useState<Phase>('loading')
  const [lastCorrect, setLastCorrect] = useState(false)
  const [finalLevel, setFinalLevel] = useState(1)
  // A ref because finish() needs the LATEST results synchronously, before the
  // setResults state update from the final answer has necessarily flushed.
  const resultsRef = useRef<ProbeResults>(emptyProbeResults())
  // Lifecycle only (the probe flow itself is untouched): the feedback pause
  // and the done -> home hop are timers, and neither was cleared. Leaving
  // mid-probe (back gesture) within 1.1s of the last answer still ran
  // finish() -- posting a result and router.replace('/home') from a screen
  // that was gone -- and leaving the done screen early still yanked the user
  // to /home 2.6s later. `alive` also stops the async load/finish from
  // setting state or navigating after unmount.
  const aliveRef = useRef(true)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  // Set on the first tap of a question, so a second tap landing before the
  // re-render (which disables the choices) can't record the answer twice.
  const answeringRef = useRef(false)
  // finish() can run from inside load(), before setChild has re-rendered, so
  // it reads the child from here.
  const childRef = useRef<Child | null>(null)
  // No usable probe items: onboarding saves the empty result (the backend
  // scores it as the default placement: level 1 everywhere, zero confidence,
  // placement_done = true -- its own test «a fully-skipped probe») and goes
  // straight home. It used to go home WITHOUT saving, and Home sends a child
  // with placement_done = false straight back here: an endless loop.
  const noContentRef = useRef(false)
  // A failed load used to read as "no probe content" and hop to /home, which
  // sends a child who hasn't been placed straight back here: now it stops on
  // LoadState with a retry. Retry clears the error first (LoadState contract).
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const retryLoad = () => { setLoadError(null); setReloadKey((k) => k + 1) }
  // A failed result POST used to show the reveal anyway, with the default
  // level (a level nobody computed) on onboarding, and move on unsaved.
  const [saveError, setSaveError] = useState<string | null>(null)
  // The spinner while it re-posts (the verdict card was still up underneath).
  const retrySave = () => { setSaveError(null); setPhase('loading'); void finish() }
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      // A listen item's clip must not follow the child out.
      stopClip()
    }
  }, [])
  function later(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      timersRef.current = timersRef.current.filter((x) => x !== t)
      if (aliveRef.current) fn()
    }, ms)
    timersRef.current.push(t)
  }

  useEffect(() => {
    async function load() {
      const childId = await getActiveChildId()
      if (!aliveRef.current) return
      if (!childId) { router.replace('/children'); return }
      const [childRes, probeRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<PlacementProbe>('/api/placement/probe'),
      ])
      if (!aliveRef.current) return
      if (!childRes.data) {
        setLoadError(childRes.error || 'اتصال برقرار نشد. دوباره تلاش کن')
        return
      }
      const c = childRes.data.find((x) => x.id === childId) ?? null
      // A stale active child (removed since): the same exit as no child at
      // all, instead of a probe whose result had nowhere to go.
      if (!c) { router.replace('/children'); return }
      setChild(c)
      childRef.current = c
      const noContent = probeRes.data
        ? !currentProbeStep(probeRes.data, emptyProbeResults())
        : probeRes.error === NO_PROBE_CONTENT
      if (noContent) {
        if (isReprobe) {
          // Nothing to re-measure. Never post an empty reprobe result: that
          // route rewrites children.level from the score, which would drop
          // the child to level 1. Home only shows the card; no loop.
          router.replace('/home')
          return
        }
        // See noContentRef. Stays on the spinner; a failed save shows
        // «نتیجه ذخیره نشد» with a retry (retrySave -> finish again).
        noContentRef.current = true
        resultsRef.current = emptyProbeResults()
        void finish()
        return
      }
      if (!probeRes.data) {
        setLoadError(probeRes.error || 'اتصال برقرار نشد. دوباره تلاش کن')
        return
      }
      setBank(probeRes.data)
      setPhase('intro')
    }
    load()
  }, [reloadKey])

  const step: ProbeStep | null = bank ? currentProbeStep(bank, results) : null
  const q = step?.question

  // Auto-play the audio prompt when a listen-question appears.
  useEffect(() => {
    if (phase !== 'question' || !q || q.mode !== 'listen') return
    const t = setTimeout(() => q.audio_url && playClip(q.audio_url), 350)
    return () => clearTimeout(t)
  }, [phase, q])

  async function finish() {
    const child = childRef.current
    if (child) {
      const path = isReprobe ? `/api/placement/${child.id}/reprobe-result` : '/api/placement/result'
      const body = isReprobe ? resultsRef.current : { child_id: child.id, results: resultsRef.current }
      if (isReprobe) {
        const res = await api.post(path, body)
        if (!aliveRef.current) return
        if (res.error) { setSaveError(res.error); return }
      } else {
        // Scoring (§5) lives server-side — it needs gate.ts's w(n) for
        // confidence — so the level for the reveal screen comes back on the
        // response instead of being computed here before the request.
        const res = await api.post<Child>(path, body)
        if (!aliveRef.current) return
        if (!res.data) { setSaveError(res.error || 'اتصال برقرار نشد. دوباره تلاش کن'); return }
        setFinalLevel(res.data.level)
      }
    }
    if (!aliveRef.current) return
    // The default placement was saved without a game: no reveal to show.
    if (noContentRef.current) { router.replace('/home'); return }
    setPhase('done')
    later(() => router.replace('/home'), 2600)
  }

  function answer(choice: ProbeChoice) {
    if (phase !== 'question' || !step || answeringRef.current) return
    answeringRef.current = true
    const ok = choice.id === step.question.correct_id
    setLastCorrect(ok)
    setPhase('feedback')
    // The verdict card's live region is Android-only; VoiceOver needs telling.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(ok ? 'آفرین!' : 'اشکالی نداره')
    later(() => {
      const updated = recordProbeAnswer(resultsRef.current, step, ok)
      resultsRef.current = updated
      setResults(updated)
      if (bank && currentProbeStep(bank, updated)) {
        answeringRef.current = false
        setPhase('question')
      } else {
        finish()
      }
    }, 1100)
  }

  if (loadError || saveError) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState
            error={loadError ?? saveError}
            title={saveError ? 'نتیجه ذخیره نشد' : undefined}
            onRetry={saveError ? retrySave : retryLoad}
            // Re-placement is a skippable card, so it can go home. Onboarding
            // can't: home sends an unplaced child straight back here.
            onBack={isReprobe ? () => goBack('/home') : undefined}
          />
        </View>
      </ScreenBackground>
    )
  }

  if (phase === 'loading') {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          {/* The shared full-screen wait (چرخی over the spinner). */}
          <LoadState error={null} loading="character" />
        </View>
      </ScreenBackground>
    )
  }

  if (phase === 'intro') {
    return (
      <ScreenBackground variant="warm" decor>
        <View style={[styles.center, styles.scene]}>
          {/* سیمرغ in person on the brand room's stage (RoomDoneCard, the
              learning rooms' card): Home's world, amber-tinted. */}
          <RoomDoneCard
            ramp={ramps.brand}
            character="simorgh"
            emotion="happy"
            title={`سلام ${child?.name ?? ''}! من سیمرغم`}
            body="بیا با هم یک بازی کوچولو کنیم تا ببینم چی بلدی — امتحان نیست، فقط بازیه!"
          />
          <ClayButton ramp={ramps.brand} label="بزن بریم!" emoji="🎈" onPress={() => setPhase('question')} style={styles.bigButton} />
          {/* Re-placement is optional (Home's card), so its intro offers a
              way out; nothing is saved until the child answers. Onboarding's
              first placement has none: Home sends an unplaced child back. */}
          {isReprobe ? <TextButton label="بعداً" onPress={() => goBack('/home')} /> : null}
        </View>
      </ScreenBackground>
    )
  }

  if (phase === 'done') {
    return (
      <ScreenBackground variant="warm" decor>
        <View style={[styles.center, styles.scene]}>
          {/* سیمرغ carries the moment, proud, on the same stage as the intro.
              Re-placement never reveals a level — a recurring scorecard is
              exactly the signal the gate/trophy split exists to hide, and a
              re-placement result can legitimately move the gate down (§2/§3). */}
          <RoomDoneCard
            ramp={ramps.brand}
            character="simorgh"
            title={`آفرین ${child?.name ?? ''}!`}
            body={isReprobe ? 'خیلی خوب بود!' : `از اینجا شروع می‌کنیم: ${LEVEL_LABELS[finalLevel]}`}
          />
          <Text style={styles.goingHome}>در حال رفتن به خانه…</Text>
        </View>
      </ScreenBackground>
    )
  }

  if (!q) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={null} loading="character" />
        </View>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
    <View style={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
      {/* No difficulty tier, question number, or "X of N" counter — the
          child's staircase branch is never revealed (§6). A single mascot
          face is enough progress feedback for this age group. */}
      <View style={styles.body}>
        {/* سیمرغ asks, like every child quiz (HostPrompt); the prompt is
            the item's own words, nothing more. */}
        <HostPrompt ramp={ramps.brand} host="simorgh" emotion="thinking" text={q.prompt} />

        {q.mode === 'listen' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="دوباره بشنو"
            onPress={() => q.audio_url && playClip(q.audio_url)}
          >
            {({ pressed }) => (
              <ClaySurface ramp={ramps.brand} tone="bright" pressed={pressed} radius={radii.pill} faceStyle={styles.speaker}>
                <Icon name="volume" color={ramps.brand.ink} size={48} strokeWidth={2.2} />
              </ClaySurface>
            )}
          </Pressable>
        ) : (
          <ClaySurface ramp={ramps.brand} tone="soft" radius={radii.md} faceStyle={styles.showTextCard}>
            <Text style={styles.showText}>{q.show_text}</Text>
          </ClaySurface>
        )}

        <View style={styles.choices}>
          {q.choices.map((c) => (
            <Pressable
              key={c.id}
              disabled={phase !== 'question'}
              onPress={() => answer(c)}
              accessibilityRole="button"
              // The face itself (a letter, or a picture read out by its emoji
              // description); a hint gives the Persian verb. Never the choice's
              // word: on a read item that would hand over the answer.
              accessibilityHint="انتخاب کن"
            >
              {({ pressed }) => (
                <ClaySurface ramp={ramps.brand} tone="soft" pressed={pressed && phase === 'question'} radius={radii.lg} faceStyle={styles.choice}>
                  <Text
                    style={c.kind === 'letter' ? styles.choiceLetter : wordEmoji(c.english ?? '') ? styles.choiceEmoji : styles.choiceWord}
                  >
                    {choiceFace(c)}
                  </Text>
                </ClaySurface>
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {phase === 'feedback' && (
        <View style={styles.feedback} pointerEvents="none" accessibilityLiveRegion="polite">
          <ClaySurface ramp={lastCorrect ? ramps.lessons : ramps.brand} tone="soft" radius={radii.lg} faceStyle={styles.feedbackFace}>
            {/* سیمرغ reacts (was 🌟 / 💛): proud for a right answer,
                encouraging for a miss -- never sad in a placement game. */}
            <CharacterArt character="simorgh" emotion={lastCorrect ? 'proud' : 'encouraging'} size={88} />
            <Text style={[styles.feedbackText, { color: lastCorrect ? ramps.lessons.ink : ramps.brand.ink }]}>
              {lastCorrect ? 'آفرین!' : 'اشکالی نداره'}
            </Text>
          </ClaySurface>
        </View>
      )}
    </View>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scene: { padding: spacing.lg, gap: spacing.sm + spacing.xs },
  goingHome: { fontSize: textSize.caption, fontFamily: fonts.medium, color: colors.text, marginTop: spacing.sm },
  bigButton: { width: '100%', maxWidth: 360 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  speaker: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  showTextCard: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md + spacing.xs, alignItems: 'center' },
  // naturalLineHeight: a read item's word can carry vowel marks.
  showText: { fontSize: 38, fontFamily: fonts.bold, color: ramps.brand.ink, lineHeight: naturalLineHeight(38) },
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm + spacing.xs, maxWidth: 340 },
  // min, not fixed: a word choice without an emoji shows the word itself,
  // which at the emoji's 34pt overflowed a 96pt tile.
  choice: { minWidth: 96, minHeight: 96, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  choiceEmoji: { fontSize: 34 },
  // naturalLineHeight: a letter choice can carry marks (Android clips them
  // in a tighter line box).
  choiceLetter: { fontSize: 34, lineHeight: naturalLineHeight(34), fontFamily: fonts.bold, color: ramps.brand.ink },
  choiceWord: { fontSize: textSize.cardTitle, lineHeight: naturalLineHeight(textSize.cardTitle), fontFamily: fonts.bold, color: ramps.brand.ink, textAlign: 'center' },
  feedback: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' },
  // A card behind the verdict: it used to float bare over the choice tiles.
  feedbackFace: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  // Ramp inks, not colors.success / #d97706 (~2.2:1 and ~3:1 on the page).
  feedbackText: { fontSize: textSize.h2, fontFamily: fonts.bold },
})
