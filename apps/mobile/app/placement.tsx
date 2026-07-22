import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, PlacementProbe, ProbeChoice, ProbeQuestion, Strand } from '@koodakbook/shared'
import { toPersianDigits, wordEmoji } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { playClip } from '@/lib/sound'
import { colors, fonts } from '@/lib/theme'

/**
 * Placement probe (web: /onboarding/placement) — a short adaptive game that
 * sets the child's starting level. Simorgh greets, then easy→hard questions;
 * the run stops at the first miss. Web speaks Simorgh's line via browser TTS;
 * mobile shows it as text (listen-questions still play their audio clip).
 */
type Phase = 'loading' | 'intro' | 'question' | 'feedback' | 'done'

function choiceFace(c: ProbeChoice): string {
  if (c.kind === 'letter') return c.character ?? c.persian
  return wordEmoji(c.english ?? '') ?? c.persian
}

const LEVEL_LABELS = ['', 'تازه‌کار', 'آشنا با کلمه‌ها', 'خواننده‌ی کوچک', 'خواننده‌ی ماهر']

export default function Placement() {
  const insets = useSafeAreaInsets()
  const [child, setChild] = useState<Child | null>(null)
  const [questions, setQuestions] = useState<ProbeQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [lastCorrect, setLastCorrect] = useState(false)
  const [finalLevel, setFinalLevel] = useState(1)
  const passed = useRef<boolean[]>([])

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
      if (!probeRes.data?.questions?.length) {
        // No probe content — skip gracefully, keep the default level.
        router.replace('/home')
        return
      }
      setQuestions(probeRes.data.questions)
      setPhase('intro')
    }
    load()
  }, [])

  const q = questions[idx]

  // Auto-play the audio prompt when a listen-question appears.
  useEffect(() => {
    if (phase !== 'question' || !q || q.mode !== 'listen') return
    const t = setTimeout(() => q.audio_url && playClip(q.audio_url), 350)
    return () => clearTimeout(t)
  }, [phase, q])

  async function finish(answers: boolean[]) {
    // Consecutive passes from the start → starting stage (1–4).
    let streak = 0
    for (const ok of answers) { if (ok) streak++; else break }
    const level = Math.min(4, 1 + streak) as 1 | 2 | 3 | 4
    // One probe item per strand: a pass lifts that strand to level 2, else 1.
    const strands: Record<Exclude<Strand, 'P'>, number> = {
      V: answers[0] ? 2 : 1,
      D: answers[1] ? 2 : 1,
      F: answers[2] ? 2 : 1,
      C: answers[3] ? 2 : 1,
    }
    setFinalLevel(level)
    setPhase('done')
    if (child) await api.post('/api/placement/result', { child_id: child.id, level, strands })
    setTimeout(() => router.replace('/home'), 2600)
  }

  function answer(choice: ProbeChoice) {
    if (phase !== 'question' || !q) return
    const ok = choice.id === q.correct_id
    passed.current[idx] = ok
    setLastCorrect(ok)
    setPhase('feedback')
    setTimeout(() => {
      // Stop at the first miss (items get harder) or when the bank is exhausted.
      if (!ok || idx + 1 >= questions.length) {
        finish(questions.map((_, i) => passed.current[i] ?? false))
      } else {
        setIdx((i) => i + 1)
        setPhase('question')
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
      <View style={[styles.center, { padding: 24, gap: 14 }]}>
        <Text style={{ fontSize: 90 }}>🦅</Text>
        <Text style={styles.introTitle}>سلام {child?.name}! من سیمرغم 🌟</Text>
        <Text style={styles.introText}>
          بیا با هم یک بازی کوچولو کنیم تا ببینم چی بلدی — امتحان نیست، فقط بازیه!
        </Text>
        <Pressable style={styles.bigButton} onPress={() => setPhase('question')}>
          <Text style={styles.bigButtonText}>بزن بریم! 🎈</Text>
        </Pressable>
      </View>
    )
  }

  if (phase === 'done') {
    return (
      <View style={[styles.center, { padding: 24, gap: 12 }]}>
        <Text style={{ fontSize: 72 }}>🎉</Text>
        <Text style={styles.introTitle}>آفرین {child?.name}!</Text>
        <Text style={styles.introText}>از اینجا شروع می‌کنیم: {LEVEL_LABELS[finalLevel]}</Text>
        <Text style={styles.goingHome}>در حال رفتن به خانه…</Text>
      </View>
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
      {/* Progress dots */}
      <View style={styles.dots}>
        {questions.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === idx ? styles.dotActive : i < idx ? styles.dotDone : styles.dotFuture,
            ]}
          />
        ))}
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

      <Text style={styles.counter}>سؤال {toPersianDigits(idx + 1)} از {toPersianDigits(questions.length)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  introTitle: { fontSize: 24, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  introText: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', lineHeight: 26, maxWidth: 300 },
  goingHome: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 8 },
  bigButton: {
    marginTop: 16, backgroundColor: colors.primary, borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 48,
  },
  bigButtonText: { color: '#fff', fontSize: 20, fontFamily: fonts.bold },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { height: 10, borderRadius: 999 },
  dotActive: { width: 28, backgroundColor: colors.primary },
  dotDone: { width: 10, backgroundColor: '#c4b5fd' },
  dotFuture: { width: 10, backgroundColor: '#e5e7eb' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  prompt: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  speaker: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  showTextCard: {
    backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 40, paddingVertical: 28,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  showText: { fontSize: 56, fontFamily: fonts.bold, color: colors.text },
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, maxWidth: 340 },
  choice: {
    width: 96, height: 96, borderRadius: 24, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  choiceEmoji: { fontSize: 46 },
  choiceLetter: { fontSize: 46, fontFamily: fonts.bold, color: colors.text },
  feedback: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 6 },
  feedbackText: { fontSize: 22, fontFamily: fonts.bold },
  counter: { textAlign: 'center', fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
})
