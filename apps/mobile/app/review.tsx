import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { goBack } from '@/lib/navigation'
import LoadState from '@/components/LoadState'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ReviewItem, Word } from '@koodakbook/shared'
import { toPersianDigits, buildReviewQuestions, buildPaddingQuestions } from '@koodakbook/shared'
import QuizCard, { QuizTopBar, type QuizQuestion } from '@/components/QuizCard'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import CelebrationOverlay from '@/components/CelebrationOverlay'
import { stopClip } from '@/lib/sound'
import { ramps, spacing } from '@/lib/theme'
import ScreenBackground from '@/components/ScreenBackground'
import { ClayButton } from '@/components/Clay'
import { RoomDoneCard } from '@/components/RoomScene'

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
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }

  useEffect(() => {
    // Guards a response that lands after the child closed the screen: it
    // must not redirect or set state for a screen that's gone.
    let cancelled = false
    async function load() {
      const activeId = await getActiveChildId()
      if (cancelled) return
      if (!activeId) { router.replace('/children'); return }
      setChildId(activeId)
      const [reviewRes, wordsRes] = await Promise.all([
        api.get<ReviewItem[]>(`/api/progress/${activeId}/review`),
        api.get<Word[]>('/api/words'),
      ])
      if (cancelled) return
      // A failed fetch used to land on the empty «nothing to review» state.
      if (!reviewRes.data) { setError(reviewRes.error ?? 'اتصال برقرار نشد. دوباره تلاش کن'); return }
      setItems(reviewRes.data)
      setPool(wordsRes.data ?? [])
    }
    load()
    return () => { cancelled = true }
  }, [reloadKey])

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

  // A word still playing (or downloading) when the child leaves must not talk
  // over the next screen.
  useEffect(() => () => stopClip(), [])

  // The done card replaces the quiz with no focus change: say the result once.
  const finished = !!items && items.length > 0 && (done || idx >= allQuestions.length)
  useEffect(() => {
    if (!finished) return
    AccessibilityInfo.announceForAccessibility(
      `آفرین! مرور تمام شد. ${toPersianDigits(correct)} از ${toPersianDigits(allQuestions.length)} درست`
    )
    // Once, when the session ends; nothing changes after it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  function report(wordId: string, result: 'correct' | 'incorrect') {
    if (!childId) return
    void api.post('/api/progress/word', { child_id: childId, word_id: wordId, status: 'practiced', result })
  }

  function advance() {
    setIdx((i) => i + 1)
  }

  if (!items) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={error} onRetry={retry} onBack={() => goBack('/home')} />
        </View>
      </ScreenBackground>
    )
  }

  // `done` is set reactively one render after idx crosses allQuestions.length
  // (see the effect above) — guard the in-between render rather than index
  // into allQuestions with an out-of-range idx.
  if (items.length === 0 || done || idx >= allQuestions.length) {
    const allCaughtUp = items.length === 0
    return (
      <ScreenBackground variant="warm">
        <View style={[styles.center, styles.doneWrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {!allCaughtUp && <CelebrationOverlay />}
          {/* لاکی, the review room's host (Home's room card), on the review
              room's stage: happy when there's nothing due (an empty state,
              not a result, so no score), proud after a session. */}
          <RoomDoneCard
            ramp={ramps.review}
            character="laki"
            emotion={allCaughtUp ? 'happy' : 'proud'}
            title={allCaughtUp ? 'همه را مرور کردی!' : 'آفرین! مرور تمام شد'}
            body={allCaughtUp ? 'الان کلمه‌ای برای مرور نداری. بعداً برگرد!' : undefined}
            score={allCaughtUp ? undefined : `${toPersianDigits(correct)} از ${toPersianDigits(allQuestions.length)} درست`}
          />
          <ClayButton ramp={ramps.review} label="برگشت به خانه" onPress={() => goBack('/home')} style={styles.doneButton} />
        </View>
      </ScreenBackground>
    )
  }

  const question = allQuestions[idx]

  return (
    <ScreenBackground variant="warm" style={{ paddingTop: insets.top + spacing.sm }}>
      {/* The shared quiz bar (the lesson player and phonics quiz use it too). */}
      <QuizTopBar
        title="مرور کلمه‌ها"
        index={idx}
        total={allQuestions.length}
        ramp={ramps.review}
        onClose={() => goBack('/home')}
      />

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}>
        <QuizCard
          key={idx}
          ramp={ramps.review}
          host="laki"
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
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.md + spacing.xs },

  doneWrap: { gap: spacing.md, padding: spacing.lg },
  doneButton: { width: '100%', maxWidth: 360 },
})
