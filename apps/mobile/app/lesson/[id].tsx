import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Badge, Child, Lesson, LessonItem, Promotion } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import QuizCard, { QuizTopBar, type QuizMode, type QuizQuestion } from '@/components/QuizCard'
import RewardPopup from '@/components/RewardPopup'
import CelebrationOverlay from '@/components/CelebrationOverlay'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { stopClip } from '@/lib/sound'
import { fonts, radii, spacing, textSize, ui } from '@/lib/theme'
import { lessonRoomStyle } from '@/lib/roomStyle'
import LoadState, { EmptyState } from '@/components/LoadState'
import ScreenBackground from '@/components/ScreenBackground'
import { ClayButton, TextButton } from '@/components/Clay'
import { RoomDoneCard } from '@/components/RoomScene'

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
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }

  useEffect(() => {
    // Guards a response that lands after the child closed the lesson (or
    // after `id` changed): it must not redirect or set state for a screen
    // that's gone.
    let cancelled = false
    async function load() {
      const activeId = await getActiveChildId()
      if (cancelled) return
      if (!activeId) { router.replace('/children'); return }
      setChildId(activeId)
      const [lessonRes, childRes] = await Promise.all([
        api.get<LessonWithItems>(`/api/lessons/${id}`),
        api.get<Child[]>('/api/children'),
      ])
      if (cancelled) return
      if (lessonRes.data) setLesson(lessonRes.data)
      else setError(lessonRes.error)
      const child = childRes.data?.find((c) => c.id === activeId)
      if (child) setChildLevel(child.level ?? 1)
    }
    load()
    return () => { cancelled = true }
  }, [id, reloadKey])

  // The lesson's progress save. A failed POST used to land on the same
  // completion screen as a saved one, so the lesson silently stayed
  // unfinished. The celebration still shows either way; a failure adds a
  // small note with a retry that re-sends the SAME score (scoreRef).
  // savingRef: one request at a time, whatever the tap speed.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'failed' | 'saved'>('idle')
  const savingRef = useRef(false)
  const scoreRef = useRef<number | null>(null)
  const aliveRef = useRef(true)

  // A word still playing (or still downloading) when the child closes the
  // lesson must not talk over the screen they went back to.
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false; stopClip() }
  }, [])

  // The done card replaces the quiz with no focus change: say the result
  // once (Android also reads the header, iOS needs telling).
  const total = correctCount + incorrectCount
  useEffect(() => {
    if (!completed || !lesson) return
    AccessibilityInfo.announceForAccessibility(
      `آفرین! درس ${lesson.title} تمام شد. ${toPersianDigits(correctCount)} از ${toPersianDigits(total)} درست`
        + (saveState === 'failed' ? `. ${SAVE_FAILED}` : '')
    )
    // Once per completion; the counts don't change after it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed])

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

  /** Posts scoreRef's score. Resolves to the first new badge, null when
   *  saved without one, 'failed', or 'busy' when a save is already running
   *  (a second tap in the same frame). Scoring is unchanged: the score is
   *  computed once in finish() and only re-sent here. */
  async function saveProgress(): Promise<Badge | null | 'failed' | 'busy'> {
    if (savingRef.current) return 'busy'
    if (!childId || !lesson || scoreRef.current === null) return 'failed'
    savingRef.current = true
    setSaveState('saving')
    let res: { error?: string | null; new_badges?: Badge[]; promotions?: Promotion[] }
    try {
      // new_badges / promotions arrive top-level on the response, not under
      // `data` — same contract as /api/progress/story.
      res = await api.post('/api/progress/lesson', {
        child_id: childId, lesson_id: lesson.id, score: scoreRef.current,
      }) as typeof res
    } catch {
      res = { error: 'failed' }
    }
    savingRef.current = false
    if (!aliveRef.current) return 'failed'
    if (res.error) { setSaveState('failed'); return 'failed' }
    setSaveState('saved')
    const badge = res.new_badges?.[0] ?? null
    if (badge) setNewBadge(badge)
    return badge
  }

  // A retry from the completion screen: its result is said out loud (the
  // note changes in place).
  async function retrySave() {
    const r = await saveProgress()
    if (r === 'busy' || !aliveRef.current) return
    AccessibilityInfo.announceForAccessibility(r === 'failed' ? SAVE_FAILED : 'پیشرفتت ذخیره شد')
  }

  async function finish(correct: number, total: number) {
    if (!childId || !lesson) { setCompleted(true); return }
    scoreRef.current = total > 0 ? Math.round((correct / total) * 100) : 100
    const r = await saveProgress()
    // A new badge: RewardPopup shows over the quiz and its close opens the
    // completion screen.
    if (r !== 'failed' && r !== 'busy' && r !== null) return
    setCompleted(true)
  }

  // Closing the badge popup (over the quiz, or over the completion screen
  // after a retry that earned one).
  const closeBadge = () => { setNewBadge(null); setCompleted(true) }

  function advance(result: 'correct' | 'incorrect' | 'seen') {
    const correct = correctCount + (result !== 'incorrect' ? 1 : 0)
    const incorrect = incorrectCount + (result === 'incorrect' ? 1 : 0)
    setCorrectCount(correct)
    setIncorrectCount(incorrect)
    reportWord(result === 'incorrect' ? 'incorrect' : undefined)
    if (idx >= questions.length - 1) void finish(correct, correct + incorrect)
    else setIdx(idx + 1)
  }

  // The lesson wears its type's room (lib/roomStyle.ts): the same ramp and
  // host as its section on the lessons list and Home's path tile, so an
  // alphabet lesson is the letters room, not always the green one.
  // Visual only. A room without a host (phonics) asks with its emoji and
  // cheers with سیمرغ, the app's guide.
  const room = lessonRoomStyle(lesson?.type ?? '')
  const ramp = room.ramp

  if (!lesson) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={error} onRetry={retry} onBack={() => goBack('/lessons')} />
        </View>
      </ScreenBackground>
    )
  }

  // A lesson with no items used to hand QuizCard `undefined` and crash on
  // its destructure. Nothing to practise, nothing to score: say so, no retry.
  // Empty, not failed: EmptyState (no error live region), with the way back
  // as its action -- this screen has no bottom nav.
  if (questions.length === 0) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <EmptyState
            character="roozi"
            emotion="thinking"
            title="این درس هنوز آماده نیست"
            body="به‌زودی تمرین‌هاش اضافه می‌شه."
            actionLabel="برگشت به درس‌ها"
            onAction={() => goBack('/lessons')}
            ramp={ramp}
          />
        </View>
      </ScreenBackground>
    )
  }

  if (completed) {
    return (
      <ScreenBackground variant="warm">
        <View style={[styles.center, styles.doneWrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {/* The same celebration as review, phonics and the math games'
              done screens (CelebrationOverlay's own list names this one):
              mounted only in this branch, so it fires once. */}
          <CelebrationOverlay />
          {newBadge && <RewardPopup badge={newBadge} onClose={closeBadge} />}
          {/* The room's host, proud, on its own little stage (the room's
              landscape, components/RoomScene.tsx). */}
          <RoomDoneCard
            ramp={ramp}
            character={room.character ?? 'simorgh'}
            title="آفرین!"
            body={`درس «${lesson.title}» تمام شد`}
            score={`${toPersianDigits(correctCount)} از ${toPersianDigits(total)} درست`}
          />
          {/* Non-blocking: the celebration stays, the note sits under it. */}
          {saveState === 'failed' || saveState === 'saving' ? (
            <View style={styles.saveNote} accessibilityLiveRegion="polite">
              <Text style={styles.saveNoteText}>{saveState === 'saving' ? 'در حال ذخیره…' : SAVE_FAILED}</Text>
              <TextButton
                label="دوباره امتحان کن"
                size="caption"
                disabled={saveState === 'saving'}
                onPress={() => { void retrySave() }}
              />
            </View>
          ) : null}
          <ClayButton ramp={ramp} label="برگشت به درس‌ها" accessibilityLabel="برگشت به درس‌ها" onPress={() => goBack('/lessons')} style={styles.doneButton} />
        </View>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm" style={{ paddingTop: insets.top + spacing.sm }}>
      {newBadge && <RewardPopup badge={newBadge} onClose={closeBadge} />}

      {/* The shared quiz bar (review and the phonics quiz use the same). */}
      <QuizTopBar
        title={lesson.title}
        index={idx}
        total={questions.length}
        ramp={ramp}
        onClose={() => goBack('/lessons')}
      />

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}>
        <QuizCard
          key={idx}
          ramp={ramp}
          host={room.character}
          hostEmoji={room.emoji}
          question={questions[idx]}
          onCorrect={() => advance('correct')}
          onIncorrect={() => advance('incorrect')}
          onFlashcardNext={() => advance('seen')}
        />
      </ScrollView>
    </ScreenBackground>
  )
}

const SAVE_FAILED = 'پیشرفتت ذخیره نشد.'

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.md + spacing.xs },

  doneWrap: { gap: spacing.md, padding: spacing.lg },
  doneButton: { width: '100%', maxWidth: 360 },
  // A quiet row, not an alert: the lesson is done either way.
  saveNote: {
    width: '100%', maxWidth: 360, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'center', columnGap: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radii.md, borderWidth: 2, borderColor: ui.divider, backgroundColor: ui.surfaceSoft,
  },
  saveNoteText: { fontFamily: fonts.medium, fontSize: textSize.caption, color: ui.text, textAlign: 'center' },
})
