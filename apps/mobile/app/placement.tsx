import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, PlacementProbe, ProbeChoice, ProbeResults, ProbeStep } from '@koodakbook/shared'
import { wordEmoji, currentProbeStep, recordProbeAnswer, emptyProbeResults } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { playClip } from '@/lib/sound'
import ScreenBackground from '@/components/ScreenBackground'
import { colors, fonts } from '@/lib/theme'

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

  useEffect(() => {
    async function load() {
      const childId = await getActiveChildId()
      if (!childId) { router.replace('/children'); return }
      const [childRes, probeRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<PlacementProbe>('/api/placement/probe'),
      ])
      const c = childRes.data?.find((x) => x.id === childId) ?? null
      setChild(c)
      if (!probeRes.data || !currentProbeStep(probeRes.data, emptyProbeResults())) {
        // No usable probe content — skip gracefully, keep the default level.
        router.replace('/home')
        return
      }
      setBank(probeRes.data)
      setPhase('intro')
    }
    load()
  }, [])

  const step: ProbeStep | null = bank ? currentProbeStep(bank, results) : null
  const q = step?.question

  // Auto-play the audio prompt when a listen-question appears.
  useEffect(() => {
    if (phase !== 'question' || !q || q.mode !== 'listen') return
    const t = setTimeout(() => q.audio_url && playClip(q.audio_url), 350)
    return () => clearTimeout(t)
  }, [phase, q])

  async function finish() {
    if (child) {
      const path = isReprobe ? `/api/placement/${child.id}/reprobe-result` : '/api/placement/result'
      const body = isReprobe ? resultsRef.current : { child_id: child.id, results: resultsRef.current }
      if (isReprobe) {
        await api.post(path, body)
      } else {
        // Scoring (§5) lives server-side — it needs gate.ts's w(n) for
        // confidence — so the level for the reveal screen comes back on the
        // response instead of being computed here before the request.
        const res = await api.post<Child>(path, body)
        if (res.data) setFinalLevel(res.data.level)
      }
    }
    setPhase('done')
    setTimeout(() => router.replace('/home'), 2600)
  }

  function answer(choice: ProbeChoice) {
    if (phase !== 'question' || !step) return
    const ok = choice.id === step.question.correct_id
    setLastCorrect(ok)
    setPhase('feedback')
    setTimeout(() => {
      const updated = recordProbeAnswer(resultsRef.current, step, ok)
      resultsRef.current = updated
      setResults(updated)
      if (bank && currentProbeStep(bank, updated)) {
        setPhase('question')
      } else {
        finish()
      }
    }, 1100)
  }

  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (phase === 'intro') {
    return (
      <ScreenBackground variant="warm" decor>
        <View style={[styles.center, styles.transparent, { padding: 24, gap: 14 }]}>
          <Text style={{ fontSize: 90 }}>🦅</Text>
          <Text style={styles.introTitle}>سلام {child?.name}! من سیمرغم 🌟</Text>
          <Text style={styles.introText}>
            بیا با هم یک بازی کوچولو کنیم تا ببینم چی بلدی — امتحان نیست، فقط بازیه!
          </Text>
          <Pressable style={styles.bigButton} onPress={() => setPhase('question')}>
            <Text style={styles.bigButtonText}>بزن بریم! 🎈</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    )
  }

  if (phase === 'done') {
    return (
      <ScreenBackground variant="warm" decor>
        <View style={[styles.center, styles.transparent, { padding: 24, gap: 12 }]}>
          <Text style={{ fontSize: 72 }}>🎉</Text>
          <Text style={styles.introTitle}>آفرین {child?.name}!</Text>
          {/* Re-placement never reveals a level — a recurring scorecard is
              exactly the signal the gate/trophy split exists to hide, and a
              re-placement result can legitimately move the gate down (§2/§3). */}
          <Text style={styles.introText}>
            {isReprobe ? 'خیلی خوب بود! 🌟' : `از اینجا شروع می‌کنیم: ${LEVEL_LABELS[finalLevel]}`}
          </Text>
          <Text style={styles.goingHome}>در حال رفتن به خانه…</Text>
        </View>
      </ScreenBackground>
    )
  }

  if (!q) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      {/* No difficulty tier, question number, or "X of N" counter — the
          child's staircase branch is never revealed (§6). A single mascot
          face is enough progress feedback for this age group. */}
      <View style={styles.mascotRow}>
        <Text style={{ fontSize: 48 }}>🦅</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.prompt}>{q.prompt}</Text>

        {q.mode === 'listen' ? (
          <Pressable
            style={styles.speaker}
            onPress={() => q.audio_url && playClip(q.audio_url)}
          >
            <Text style={{ fontSize: 44 }}>🔊</Text>
          </Pressable>
        ) : (
          <View style={styles.showTextCard}>
            <Text style={styles.showText}>{q.show_text}</Text>
          </View>
        )}

        <View style={styles.choices}>
          {q.choices.map((c) => (
            <Pressable
              key={c.id}
              style={styles.choice}
              disabled={phase !== 'question'}
              onPress={() => answer(c)}
            >
              <Text style={c.kind === 'letter' ? styles.choiceLetter : styles.choiceEmoji}>{choiceFace(c)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {phase === 'feedback' && (
        <View style={styles.feedback} pointerEvents="none">
          <Text style={{ fontSize: 56 }}>{lastCorrect ? '🌟' : '💛'}</Text>
          <Text style={[styles.feedbackText, { color: lastCorrect ? colors.success : '#d97706' }]}>
            {lastCorrect ? 'آفرین!' : 'اشکالی نداره'}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  transparent: { backgroundColor: 'transparent' },
  introTitle: { fontSize: 24, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  introText: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', lineHeight: 26, maxWidth: 300 },
  goingHome: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 8 },
  bigButton: {
    marginTop: 16, backgroundColor: colors.primary, borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 48,
  },
  bigButtonText: { color: '#fff', fontSize: 20, fontFamily: fonts.bold },
  mascotRow: { flexDirection: 'row', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  prompt: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  speaker: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  showTextCard: {
    backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 28, paddingVertical: 20,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  showText: { fontSize: 38, fontFamily: fonts.bold, color: colors.text },
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, maxWidth: 340 },
  choice: {
    width: 96, height: 96, borderRadius: 24, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  choiceEmoji: { fontSize: 34 },
  choiceLetter: { fontSize: 34, fontFamily: fonts.bold, color: colors.text },
  feedback: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 6 },
  feedbackText: { fontSize: 22, fontFamily: fonts.bold },
})
