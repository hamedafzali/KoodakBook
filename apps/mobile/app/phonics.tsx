import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  PHONICS_CONSONANTS, SHORT_VOWELS, phonicsAudioUrl, phonicsSyllables,
  toPersianDigits, type Syllable,
} from '@koodakbook/shared'
import { playClip } from '@/lib/sound'
import { shuffle } from '@/lib/math'
import { colors, fonts } from '@/lib/theme'

/* صداها (zebar/zir/pish) — ported from web /child/phonics. Learn: tap any
 * syllable, see it big on the stage and hear its blend. Quiz: hear one, pick
 * it from four. Web's fly-together merge animation is simplified to a stage
 * reveal; the audio timing (the actual lesson) is identical. */

const DEMO = 'ب'
const VOWEL_TINTS: Record<string, string> = { zebar: '#f97316', zir: '#0ea5e9', pish: '#8b5cf6' }

export default function PhonicsPage() {
  const insets = useSafeAreaInsets()
  const all = useMemo(() => phonicsSyllables(), [])
  const [phase, setPhase] = useState<'learn' | 'quiz' | 'done'>('learn')
  const [stage, setStage] = useState<{ text: string; markName: string } | null>(null)

  function demo(text: string, markName: string, slug: string) {
    setStage({ text, markName })
    playClip(phonicsAudioUrl(slug))
  }

  if (phase === 'quiz') {
    return <PhonicsQuiz all={all} onDone={() => setPhase('done')} onExit={() => setPhase('learn')} />
  }

  if (phase === 'done') {
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 56 }}>🌟</Text>
        <Text style={styles.doneTitle}>آفرین! 🌟</Text>
        <Text style={styles.doneSub}>حالا می‌تونی حرف‌ها رو بخونی!</Text>
        <Pressable style={styles.primaryButton} onPress={() => setPhase('quiz')}>
          <Text style={styles.primaryText}>یک بار دیگه 🔁</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>برگشت به خانه 🏠</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      stickyHeaderIndices={[1]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>صداها 🎵</Text>
          <Text style={styles.subtitle}>زبر، زیر، پیش — ضربه بزن، ببین و گوش کن!</Text>
        </View>
      </View>

      {/* The stage — sticky so every tap below plays here in view */}
      <View style={{ backgroundColor: colors.bg, paddingVertical: 6 }}>
        <View style={styles.stage}>
          {stage ? (
            <>
              <Text style={styles.stageText}>{stage.text}</Text>
              <Text style={styles.stageMark}>{stage.markName}</Text>
            </>
          ) : (
            <Text style={styles.stageHint}>روی یک هجا ضربه بزن تا ببینی چطور ساخته می‌شود ✨</Text>
          )}
        </View>
      </View>

      <Text style={styles.section}>حرکت‌ها</Text>
      <View style={styles.vowelRow}>
        {SHORT_VOWELS.map((v) => {
          const syll = DEMO + v.mark
          return (
            <Pressable
              key={v.key}
              style={[styles.vowelTile, { backgroundColor: VOWEL_TINTS[v.key] ?? colors.primary }]}
              onPress={() => demo(syll, v.namePersian, 'b' + v.latin)}
            >
              <Text style={styles.vowelSyll}>{syll}</Text>
              <Text style={styles.vowelName}>{v.namePersian}</Text>
              <Text style={styles.vowelLatin}>{v.latin}</Text>
            </Pressable>
          )
        })}
      </View>

      {SHORT_VOWELS.map((v) => (
        <View key={v.key} style={{ gap: 10 }}>
          <Text style={styles.section}>
            با {v.namePersian} <Text style={styles.sectionLatin}>({v.latin})</Text>
          </Text>
          <View style={styles.syllGrid}>
            {PHONICS_CONSONANTS.map((c) => {
              const text = c.ch + v.mark
              const slug = c.latin + v.latin
              return (
                <Pressable key={slug} style={styles.syllTile} onPress={() => demo(text, v.namePersian, slug)}>
                  <Text style={styles.syllText}>{text}</Text>
                  <Text style={styles.syllLatin}>{slug}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}

      <Pressable style={styles.primaryButton} onPress={() => setPhase('quiz')}>
        <Text style={styles.primaryText}>بریم تمرین 🎧</Text>
      </Pressable>
    </ScrollView>
  )
}

function PhonicsQuiz({ all, onDone, onExit }: {
  all: Syllable[]
  onDone: () => void
  onExit: () => void
}) {
  const insets = useSafeAreaInsets()
  const ROUNDS = 6
  const questions = useMemo(
    () =>
      shuffle(all).slice(0, ROUNDS).map((correct) => ({
        correct,
        options: shuffle([correct, ...shuffle(all.filter((s) => s.slug !== correct.slug)).slice(0, 3)]),
      })),
    [all]
  )

  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const doneRef = useRef(false)
  const q = questions[idx]

  useEffect(() => {
    const t = setTimeout(() => playClip(phonicsAudioUrl(q.correct.slug)), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  function choose(slug: string) {
    if (picked) return
    setPicked(slug)
    setTimeout(() => {
      if (idx >= questions.length - 1) {
        if (!doneRef.current) { doneRef.current = true; onDone() }
      } else {
        setPicked(null)
        setIdx((i) => i + 1)
      }
    }, 900)
  }

  return (
    <View style={[styles.quiz, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.header}>
        <Pressable onPress={onExit} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>گوش کن و انتخاب کن 🎧</Text>
        </View>
        <Text style={styles.counter}>
          {toPersianDigits(idx + 1)}/{toPersianDigits(questions.length)}
        </Text>
      </View>

      <View style={styles.quizBody}>
        <Pressable style={styles.speaker} onPress={() => playClip(phonicsAudioUrl(q.correct.slug))}>
          <Text style={{ fontSize: 40 }}>🔊</Text>
        </Pressable>
        <Text style={styles.quizHint}>کدام را شنیدی؟</Text>
        <View style={styles.quizGrid}>
          {q.options.map((opt) => {
            const isCorrect = opt.slug === q.correct.slug
            const show = picked !== null
            const bg = show
              ? isCorrect ? styles.optRight : opt.slug === picked ? styles.optWrong : undefined
              : undefined
            return (
              <Pressable key={opt.slug} style={[styles.opt, bg]} onPress={() => choose(opt.slug)}>
                <Text style={styles.optText}>{opt.text}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  stage: {
    backgroundColor: colors.card, borderRadius: 20, minHeight: 104,
    alignItems: 'center', justifyContent: 'center', padding: 12, gap: 2,
  },
  stageText: { fontSize: 56, fontFamily: fonts.bold, color: '#d97706', lineHeight: 76 },
  stageMark: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  stageHint: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  section: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  sectionLatin: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  vowelRow: { flexDirection: 'row', gap: 10 },
  vowelTile: { flex: 1, borderRadius: 20, padding: 14, alignItems: 'center', gap: 2, minHeight: 108, justifyContent: 'center' },
  vowelSyll: { fontSize: 40, fontFamily: fonts.bold, color: '#fff', lineHeight: 56 },
  vowelName: { fontSize: 13, fontFamily: fonts.medium, color: '#fff' },
  vowelLatin: { fontSize: 11, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.8)' },
  syllGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  syllTile: {
    width: '22.7%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 14,
    paddingVertical: 10, alignItems: 'center', gap: 1,
  },
  syllText: { fontSize: 26, fontFamily: fonts.bold, color: colors.text, lineHeight: 38 },
  syllLatin: { fontSize: 10, fontFamily: fonts.regular, color: colors.muted },
  quiz: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, gap: 10 },
  counter: { fontSize: 13, fontFamily: fonts.medium, color: '#d97706' },
  quizBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  speaker: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  quizHint: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted },
  quizGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  opt: {
    width: '48%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 2, borderColor: '#e5e7eb', paddingVertical: 20, alignItems: 'center',
  },
  optRight: { backgroundColor: '#dcfce7', borderColor: colors.success },
  optWrong: { backgroundColor: '#fee2e2', borderColor: colors.danger },
  optText: { fontSize: 34, fontFamily: fonts.bold, color: colors.text, lineHeight: 48 },
  doneTitle: { fontSize: 26, fontFamily: fonts.bold, color: colors.text },
  doneSub: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted },
  primaryButton: {
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', paddingHorizontal: 40,
  },
  primaryText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  secondaryButton: {
    borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 40,
  },
  secondaryText: { color: colors.muted, fontSize: 15, fontFamily: fonts.bold },
})
