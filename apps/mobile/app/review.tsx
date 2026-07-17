import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ReviewItem, Word } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import QuizCard, { type QuizMode, type QuizQuestion } from '@/components/QuizCard'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

/** Spaced-repetition review — mobile port of web's /child/review. */
export default function Review() {
  const insets = useSafeAreaInsets()
  const [childId, setChildId] = useState('')
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [pool, setPool] = useState<Word[]>([])
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

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

  const questions = useMemo<QuizQuestion[]>(() => {
    if (!items || items.length === 0) return []
    const modes: QuizMode[] = ['match_image', 'listen_tap']
    return items.map((it) => ({
      mode: modes[Math.floor(Math.random() * modes.length)],
      correctWord: it.word,
      distractorWords: pickRandom(pool.filter((w) => w.id !== it.word.id), 3),
    }))
  }, [items, pool])

  function report(wordId: string, result: 'correct' | 'incorrect') {
    if (!childId) return
    void api.post('/api/progress/word', { child_id: childId, word_id: wordId, status: 'practiced', result })
  }

  function advance() {
    if (idx >= questions.length - 1) setDone(true)
    else setIdx((i) => i + 1)
  }

  if (!items) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (items.length === 0 || done) {
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
            : `${toPersianDigits(correct)} از ${toPersianDigits(questions.length)} درست`}
        </Text>
        <Pressable style={styles.homeButton} onPress={() => router.back()}>
          <Text style={styles.homeButtonText}>برگشت به خانه 🏠</Text>
        </Pressable>
      </View>
    )
  }

  const question = questions[idx]
  const progress = (idx / Math.max(questions.length, 1)) * 100

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
              {toPersianDigits(idx + 1)}/{toPersianDigits(questions.length)}
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
            if (question.correctWord) report(question.correctWord.id, 'correct')
            setCorrect((c) => c + 1)
            advance()
          }}
          onIncorrect={() => {
            if (question.correctWord) report(question.correctWord.id, 'incorrect')
            advance()
          }}
          onFlashcardNext={() => {
            if (question.correctWord) report(question.correctWord.id, 'correct')
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
