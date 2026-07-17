import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Badge, Child, Lesson, LessonItem, Promotion } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import QuizCard, { type QuizMode, type QuizQuestion } from '@/components/QuizCard'
import RewardPopup from '@/components/RewardPopup'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'

type LessonWithItems = Lesson & { items: LessonItem[] }

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

// Same policy as web's lesson page: level-1 children get flashcards only;
// older ones get a random quiz mode per word. Letters are always flashcards.
function buildQuestion(item: LessonItem, allItems: LessonItem[], childLevel: number): QuizQuestion {
  if (item.word) {
    const mode: QuizMode = childLevel <= 1
      ? 'flashcard'
      : (['match_image', 'listen_tap', 'name_it'] as QuizMode[])[Math.floor(Math.random() * 3)]
    const pool = allItems.filter((i) => i.word && i.word.id !== item.word!.id).map((i) => i.word!)
    return { mode, correctWord: item.word, distractorWords: pickRandom(pool, 3) }
  }
  if (item.letter) return { mode: 'flashcard', correctLetter: item.letter }
  return { mode: 'flashcard' }
}

export default function LessonPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [lesson, setLesson] = useState<LessonWithItems | null>(null)
  const [childId, setChildId] = useState('')
  const [childLevel, setChildLevel] = useState(1)
  const [idx, setIdx] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [newBadge, setNewBadge] = useState<Badge | null>(null)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const activeId = await getActiveChildId()
      if (!activeId) { router.replace('/children'); return }
      setChildId(activeId)
      const [lessonRes, childRes] = await Promise.all([
        api.get<LessonWithItems>(`/api/lessons/${id}`),
        api.get<Child[]>('/api/children'),
      ])
      if (lessonRes.data) setLesson(lessonRes.data)
      else setError(lessonRes.error)
      const child = childRes.data?.find((c) => c.id === activeId)
      if (child) setChildLevel(child.level ?? 1)
    }
    load()
  }, [id])

  const questions = useMemo<QuizQuestion[]>(
    () => (lesson ? lesson.items.map((item) => buildQuestion(item, lesson.items, childLevel)) : []),
    [lesson, childLevel]
  )

  function reportWord(result?: 'incorrect') {
    const word = questions[idx]?.correctWord
    if (!childId || !word) return
    // Fire-and-forget like web: a lost ping must never stall the quiz.
    void api.post('/api/progress/word', {
      child_id: childId, word_id: word.id, status: 'practiced', ...(result ? { result } : {}),
    })
  }

  async function finish(correct: number, total: number) {
    if (!childId || !lesson) { setCompleted(true); return }
    const score = total > 0 ? Math.round((correct / total) * 100) : 100
    try {
      // new_badges / promotions arrive top-level on the response (same
      // contract as /api/progress/story; web's data.promotions read is a bug).
      const res = await api.post('/api/progress/lesson', {
        child_id: childId, lesson_id: lesson.id, score,
      }) as { new_badges?: Badge[]; promotions?: Promotion[] }
      if (res.new_badges?.[0]) { setNewBadge(res.new_badges[0]); return }
    } catch { /* completion screen still shows */ }
    setCompleted(true)
  }

  function advance(result: 'correct' | 'incorrect' | 'seen') {
    const correct = correctCount + (result !== 'incorrect' ? 1 : 0)
    const incorrect = incorrectCount + (result === 'incorrect' ? 1 : 0)
    setCorrectCount(correct)
    setIncorrectCount(incorrect)
    reportWord(result === 'incorrect' ? 'incorrect' : undefined)
    if (idx >= questions.length - 1) void finish(correct, correct + incorrect)
    else setIdx(idx + 1)
  }

  if (!lesson) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  if (completed) {
    const total = correctCount + incorrectCount
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 100
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 56 }}>{score >= 80 ? '🌟' : '🎈'}</Text>
        <Text style={styles.doneTitle}>آفرین! 🌟</Text>
        <Text style={styles.doneSub}>درس «{lesson.title}» تمام شد</Text>
        <Text style={styles.doneScore}>
          {toPersianDigits(correctCount)} از {toPersianDigits(total)} درست
        </Text>
        <Pressable style={styles.homeButton} onPress={() => router.back()}>
          <Text style={styles.homeButtonText}>برگشت 🏠</Text>
        </Pressable>
      </View>
    )
  }

  const progress = (idx / Math.max(questions.length, 1)) * 100

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {newBadge && <RewardPopup badge={newBadge} onClose={() => setCompleted(true)} />}

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={styles.lessonTitle} numberOfLines={1}>{lesson.title}</Text>
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
          question={questions[idx]}
          onCorrect={() => advance('correct')}
          onIncorrect={() => advance('incorrect')}
          onFlashcardNext={() => advance('seen')}
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
  lessonTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text, flex: 1 },
  counter: { fontSize: 13, fontFamily: fonts.medium, color: '#d97706' },
  track: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
  body: { padding: 20, paddingBottom: 40 },
  doneTitle: { fontSize: 26, fontFamily: fonts.bold, color: colors.text },
  doneSub: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted },
  doneScore: { fontSize: 16, fontFamily: fonts.medium, color: colors.success },
  homeButton: {
    marginTop: 12, backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 48,
  },
  homeButtonText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
