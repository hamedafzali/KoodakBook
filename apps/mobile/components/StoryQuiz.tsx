import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { toPersianDigits } from '@koodakbook/shared'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import type { StoryQuestion } from '@koodakbook/shared'
import { characterSvg } from '@/lib/characterSvg'
import { playSuccess, playTap } from '@/lib/uiSound'
import { ClaySurface, TextButton } from '@/components/Clay'
import ScreenBackground from '@/components/ScreenBackground'
import { Icon } from '@/components/Icon'
import { answerRamps, colors, fonts, naturalLineHeight, radii, ramps, spacing, textSize } from '@/lib/theme'

/* ── Story comprehension quiz ────────────────────────────────────────────────
 *
 * Mobile port of web's components/child/StoryQuiz.tsx, shown after the last
 * page of a story that has questions (migration 064), before the story is
 * marked complete. Same rules as web, ported rather than reinvented:
 *
 *  1. Skippable in one press («رد شدن»), and a skip ends the WHOLE quiz --
 *     a check a child can't escape turns finishing a story into a test.
 *  2. Nothing is scored. A wrong answer gets the same warm treatment as a
 *     right one, with the real answer folded in -- recall practice, not a
 *     grade. No retry, no server call.
 *  3. Every answer auto-advances after ADVANCE_DELAY_MS, right or wrong, so a
 *     tap always moves forward.
 *
 * Where this deliberately differs from web (2026-09-24, Phase 4):
 *  - The advance timer is cancelled on unmount. Web's never is; here a
 *    hardware-back / swipe during the 1.6s would otherwise fire onDone on a
 *    screen that's gone, and the story screen's finish() would then post the
 *    completion and goBack() from wherever the child had navigated to.
 *  - onDone is never called during render (web calls it when a question is
 *    missing); an effect does it instead.
 *  - Feedback is announced to screen readers (web has no announcement).
 *  - No question-change animation (web fades between questions).
 *  - 2026-09-26: the page is the story reader's own warm gradient (it was a
 *    flat colors.bg, so finishing a story flashed to a different background)
 *    and the answers are the shared ClaySurface instead of a hand-built edge.
 *    Secondary text is colors.text, not muted (muted is ~4.4:1 on the
 *    gradient's darker end).
 * Question text is not read aloud: StoryQuestion carries no audio, and TTS
 * would need a new server call or dependency -- out of scope for this pass.
 */

const ADVANCE_DELAY_MS = 1600

const INTRO_TEXT = 'بیا ببینیم چقدر یادته!'
const CORRECT_TEXT = 'آفرین، درست بود! 🎉'
const answerText = (choice: string) => `جواب درست: «${choice}»`

/** Web's Mascot moods for this screen, same emotion + intensity pairs as
 *  web's components/child/mood.ts (MOOD_TO_EMOTION / MOOD_INTENSITY). */
const MOOD = {
  thinking: { emotion: 'thinking', intensity: 0.7 },
  proud: { emotion: 'proud', intensity: 0.95 },
  encouraging: { emotion: 'encouraging', intensity: 0.85 },
} as const

/**
 * The questions the quiz can actually show. Defensive on purpose: rows come
 * from the API (story_questions is only CHECK-constrained on correct_index,
 * not on the choices array), and a malformed one must never crash the story
 * screen or render a blank answer. A usable question has non-empty Persian
 * text, an array of at least two string choices, and an integer
 * correct_index pointing inside that array. Content is never altered --
 * unusable questions are just left out, in the API's order.
 */
export function usableQuestions(questions: unknown): StoryQuestion[] {
  if (!Array.isArray(questions)) return []
  return questions.filter((q): q is StoryQuestion => {
    if (!q || typeof q !== 'object') return false
    const { question_persian, choices, correct_index } = q as Partial<StoryQuestion>
    return (
      typeof question_persian === 'string' && question_persian.length > 0 &&
      Array.isArray(choices) && choices.length >= 2 &&
      choices.every((c) => typeof c === 'string') &&
      typeof correct_index === 'number' && Number.isInteger(correct_index) &&
      correct_index >= 0 && correct_index < choices.length
    )
  })
}

export default function StoryQuiz({
  questions, onDone,
}: {
  /** Already filtered through usableQuestions(). */
  questions: StoryQuestion[]
  /** Called at most once -- after the last answer, or on skip. Never after
   *  this component has unmounted. */
  onDone: () => void
}) {
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  // The pending auto-advance. A ref, not state: it's set synchronously on the
  // first tap, so a second tap in the same frame (before `picked` re-renders)
  // still sees it and can't schedule a second advance.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finished = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
    }
  }, [])

  function complete() {
    if (finished.current || !mounted.current) return
    finished.current = true
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    onDone()
  }

  const q = questions[index]

  // No question to show (caller passed an empty list): finish from an
  // effect, not during render.
  useEffect(() => {
    if (!q) complete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  if (!q) return null

  const answered = picked !== null
  const correct = answered && picked === q.correct_index
  const isLast = index === questions.length - 1

  function choose(i: number) {
    if (picked !== null || timer.current || finished.current) return
    setPicked(i)
    const right = i === q.correct_index
    if (right) playSuccess(); else playTap()
    AccessibilityInfo.announceForAccessibility(right ? CORRECT_TEXT : answerText(q.choices[q.correct_index]))
    timer.current = setTimeout(() => {
      timer.current = null
      if (!mounted.current) return
      if (isLast) { complete(); return }
      setIndex(index + 1)
      setPicked(null)
    }, ADVANCE_DELAY_MS)
  }

  const mood = !answered ? MOOD.thinking : correct ? MOOD.proud : MOOD.encouraging

  return (
    <ScreenBackground variant="warm" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* سیمرغ in a white disc with the quiz ramp's rim, the same host
            treatment as every other room (Clay.tsx HostAvatar proportions). */}
        <View style={styles.halo} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <SvgXml
            xml={characterSvg('simorgh', { emotion: mood.emotion, intensity: mood.intensity, size: 104 })}
            width={104}
            height={104}
          />
        </View>

        {index === 0 && !answered && <Text style={styles.intro}>{INTRO_TEXT}</Text>}

        {/* Where the child is in the quiz (real count, not a score). */}
        {questions.length > 1 && (
          <Text style={styles.counter}>
            سؤال {toPersianDigits(index + 1)} از {toPersianDigits(questions.length)}
          </Text>
        )}

        <Text style={styles.question} accessibilityRole="header">{q.question_persian}</Text>

        <View style={styles.choices}>
          {q.choices.map((choice, i) => {
            const isCorrect = i === q.correct_index
            const wrongPick = answered && i === picked && !isCorrect
            const label =
              choice +
              (answered && isCorrect ? '، جواب درست' : '') +
              (wrongPick ? '، انتخاب تو' : '')
            return (
              <Pressable
                key={i}
                onPress={() => choose(i)}
                disabled={answered}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled: answered, selected: picked === i }}
                style={wrongPick && styles.faded}
              >
                {({ pressed }) => {
                  // Bright clay: ink text on the review ramp's bright fill
                  // (DESIGN_CHARTER: dark ink on bright). Grows with the text.
                  // Once answered, the right one turns the shared "right"
                  // green (theme answerRamps) with a check -- never colour
                  // alone. A wrong pick only fades (no red: nothing is scored).
                  const r = answered && isCorrect ? answerRamps.right : ramps.review
                  return (
                    <ClaySurface ramp={r} tone="bright" pressed={pressed && !answered} radius={radii.md} faceStyle={styles.choice}>
                      {answered && isCorrect && (
                        <View style={styles.checkDisc}>
                          <Icon name="check" color={r.ink} size={16} strokeWidth={3.2} />
                        </View>
                      )}
                      <Text style={[styles.choiceText, { color: r.ink }]}>{choice}</Text>
                    </ClaySurface>
                  )
                }}
              </Pressable>
            )
          })}
        </View>

        {answered && (
          <Text style={[styles.feedback, { color: correct ? ramps.review.ink : colors.text }]}>
            {correct ? CORRECT_TEXT : answerText(q.choices[q.correct_index])}
          </Text>
        )}

        {/* The shared tertiary action (Clay.tsx TextButton): 44pt, underlined. */}
        {!answered && <TextButton label="رد شدن" onPress={complete} />}
      </ScrollView>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  // Centered column: no alignItems flex-start/end anywhere, so nothing here
  // can end up on the wrong side under forced RTL.
  content: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, gap: 16,
  },
  halo: {
    width: 128, height: 128, borderRadius: radii.pill, backgroundColor: colors.card,
    borderWidth: 3, borderColor: ramps.review.bright, alignItems: 'center', justifyContent: 'center',
  },
  intro: { fontSize: textSize.small, fontFamily: fonts.regular, color: colors.text, textAlign: 'center' },
  counter: { fontSize: textSize.caption, fontFamily: fonts.bold, color: ramps.review.ink, textAlign: 'center' },
  question: {
    fontSize: textSize.cardTitle, lineHeight: 34, fontFamily: fonts.bold, color: colors.text,
    textAlign: 'center', writingDirection: 'rtl', maxWidth: 420,
  },
  choices: { width: '100%', maxWidth: 420, gap: 12 },
  faded: { opacity: 0.6 },
  // minHeight, not height: ClayButton's 56pt, and a long answer wraps.
  choice: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs,
  },
  checkDisc: {
    width: 28, height: 28, borderRadius: radii.pill, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  choiceText: {
    flexShrink: 1, fontSize: textSize.body, lineHeight: naturalLineHeight(textSize.body),
    fontFamily: fonts.bold, color: ramps.review.ink, textAlign: 'center',
  },
  feedback: { fontSize: textSize.small, fontFamily: fonts.bold, textAlign: 'center' },
})
