import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ReviewItem, Word } from '@koodakbook/shared'
import { toPersianDigits, buildReviewQuestions, buildPaddingQuestions } from '@koodakbook/shared'
import QuizCard, { type QuizQuestion } from '@/components/QuizCard'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'

// Frustration loop (mig-051): the backend attaches `easing`/`needsReteach` to
// each due word — thresholds live server-side (frustration.ts), and what to
// DO about the flags (mode choice, distractors, the re-teach beat, win-
// padding) lives in `@koodakbook/shared`'s reviewFrustration module, shared
// with web so the two clients can't drift on it (they had — this file used
// to ignore both flags entirely).

/** Spaced-repetition review — mobile port of web's /child/review. */
export default function Review() {
  const insets = useSafeAreaInsets()
  const [childId, setChildId] = useState('')
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [pool, setPool] = useState<Word[]>([])
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  // Stage 3 padding: quick, unscored wins appended when a word is still
  // missed right after its re-teach beat, so the session doesn't end on a
  // loss streak. Kept separate from `questions` (a pure function of
  // items/pool) rather than mutated into it.
  const [extraQuestions, setExtraQuestions] = useState<QuizQuestion[]>([])
  // Which words have already had their re-teach flashcard shown this
  // session — a same-session sequencing fact, not derived from the
  // threshold numbers (which this file never needs to know).
  const reteachShownRef = useRef<Set<string>>(new Set())
  const sessionWinsRef = useRef<Word[]>([])

  useEffect(() => {
    async function load() {
      const activeId = await getActiveChildId()
      if (!activeId) { router.replace('/children'); return }
      setChildId(activeId)
      const [reviewRes, wordsRes] = await Promise.all([
        api.get<ReviewItem[]>(`/api/progress/${activeId}/review`),
        api.get<Word[]>('/api/words'),
      ])
      setItems(reviewRes.data ?? [])
      setPool(wordsRes.data ?? [])
    }
    load()
  }, [])

  const questions = useMemo<QuizQuestion[]>(
    () => (!items || items.length === 0 ? [] : buildReviewQuestions(items, pool)),
    [items, pool],
  )

  const allQuestions = useMemo(() => [...questions, ...extraQuestions], [questions, extraQuestions])

  // Derived from idx/allQuestions rather than decided imperatively inside
  // advance() — extraQuestions can land in the same tick as the advance that
  // needed it, and an imperative check risks reading the pre-append length.
  useEffect(() => {
    if (allQuestions.length > 0 && idx >= allQuestions.length) setDone(true)
  }, [idx, allQuestions.length])

  function report(wordId: string, result: 'correct' | 'incorrect') {
    if (!childId) return
    void api.post('/api/progress/word', { child_id: childId, word_id: wordId, status: 'practiced', result })
  }

  function advance() {
    setIdx((i) => i + 1)
  }

  if (!items) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  // `done` is set reactively one render after idx crosses allQuestions.length
  // (see the effect above) — guard the in-between render rather than index
  // into allQuestions with an out-of-range idx.
  if (items.length === 0 || done || idx >= allQuestions.length) {
    const allCaughtUp = items.length === 0
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 56 }}>{allCaughtUp ? '🎉' : '🌟'}</Text>
        <Text style={styles.doneTitle}>
          {allCaughtUp ? 'همه را مرور کردی! 🎉' : 'آفرین! مرور تمام شد 🌟'}
        </Text>
        <Text style={styles.doneSub}>
          {allCaughtUp
            ? 'الان کلمه‌ای برای مرور نداری. بعداً برگرد!'
            : `${toPersianDigits(correct)} از ${toPersianDigits(allQuestions.length)} درست`}
        </Text>
        <Pressable style={styles.homeButton} onPress={() => router.back()}>
          <Text style={styles.homeButtonText}>برگشت به خانه 🏠</Text>
        </Pressable>
      </View>
    )
  }

  const question = allQuestions[idx]
  const progress = (idx / Math.max(allQuestions.length, 1)) * 100

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={styles.title}>مرور کلمه‌ها 🔄</Text>
            <Text style={styles.counter}>
              {toPersianDigits(idx + 1)}/{toPersianDigits(allQuestions.length)}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <QuizCard
          key={idx}
          question={question}
          onCorrect={() => {
            if (question.correctWord) {
              report(question.correctWord.id, 'correct')
              sessionWinsRef.current.push(question.correctWord)
            }
            setCorrect((c) => c + 1)
            advance()
          }}
          onIncorrect={() => {
            const word = question.correctWord
            if (word) {
              report(word.id, 'incorrect')
              // Stage 3: still wrong right after its re-teach beat — pad the
              // rest of THIS session with a couple of already-correct wins
              // from earlier, so the session doesn't end on a loss streak
              // (bench happens server-side via missIntervalDays; this is
              // purely cosmetic).
              if (reteachShownRef.current.has(word.id)) {
                const padding = buildPaddingQuestions(sessionWinsRef.current, 2)
                if (padding.length > 0) setExtraQuestions((q) => [...q, ...padding])
              }
            }
            advance()
          }}
          onFlashcardNext={() => {
            // No-scoring exposure (both the stage-2 re-teach beat and the
            // stage-3 win-padding flashcards) — must NOT report 'correct',
            // or a re-teach would silently inflate the Leitner box.
            if (question.correctWord) reteachShownRef.current.add(question.correctWord.id)
            advance()
          }}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  close: { fontSize: 20, color: colors.muted },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  counter: { fontSize: 13, fontFamily: fonts.medium, color: '#d97706' },
  track: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
  body: { padding: 20, paddingBottom: 40 },
  doneTitle: { fontSize: 24, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  doneSub: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  homeButton: {
    marginTop: 12, backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 40,
  },
  homeButtonText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
})
