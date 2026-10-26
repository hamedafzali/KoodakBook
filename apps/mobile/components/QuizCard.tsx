import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, I18nManager, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import type { Letter, Word } from '@koodakbook/shared'
import { toPersianDigits, wordEmoji } from '@koodakbook/shared'
import { thumbUrl } from '@/lib/media'
import { playClip } from '@/lib/sound'
import { ClayButton, ClaySurface, HostAvatar, ProgressTrack } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { answerRamps, fonts, iconSize, naturalLineHeight, radii, ramps, scenery, shape, spacing, textSize, textStart, textStyles, ui, type Ramp } from '@/lib/theme'

// Mobile port of web's QuizCard (components/child/QuizCard.tsx) — same four
// modes, same reveal-then-advance rhythm, minus the web-only sound effects.
//
// 2026-09-26 consistency pass: the cards, options, speaker and next button
// are the shared clay now (components/Clay.tsx) in the caller's `ramp` --
// the same soft-clay options, bright-clay speaker disc and answer states
// (theme `answerRamps`) as the phonics and placement quizzes -- instead of
// flat white cards, a one-off amber button and #d97706 hint text (~3:1).
// Quiz logic, modes and timing are unchanged.
export type QuizMode = 'flashcard' | 'listen_tap' | 'match_image' | 'name_it'

export interface QuizQuestion {
  mode: QuizMode
  correctWord?: Word
  correctLetter?: Letter
  distractorWords?: Word[]
}

interface Props {
  question: QuizQuestion
  onCorrect: () => void
  onIncorrect: () => void
  onFlashcardNext: () => void
  /** The room's ramp (lessons, review...). Defaults to the brand ramp. */
  ramp?: Ramp
  /** The room's host (a cast slug) who asks the question; without one the
   *  room's emoji sits in the disc (Clay.tsx's Fallback rule). */
  host?: string
  hostEmoji?: string
}

function wordVisual(word: Word): { type: 'img' | 'emoji'; value: string } | null {
  const img = thumbUrl(word.image_url, 80)
  if (img) return { type: 'img', value: img }
  const e = wordEmoji(word.english)
  if (e) return { type: 'emoji', value: e }
  return null
}

function shuffleOnce<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function QuizCard({ question, onCorrect, onIncorrect, onFlashcardNext, ramp = ramps.brand, host, hostEmoji }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  // `feedback` is state, so two taps in one frame both saw null and both
  // answered (two onCorrect calls: a skipped question). The ref flips at once.
  // The card remounts per question, so one answer per mount is right.
  const answeredRef = useRef(false)
  const answerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Leaving mid-feedback must not fire onCorrect/onIncorrect on a screen
  // that is gone.
  useEffect(() => () => { if (answerTimer.current) clearTimeout(answerTimer.current) }, [])
  const { correctWord, correctLetter, distractorWords = [] } = question
  // match_image asks «what is this picture?», so a word with no image and no
  // emoji used to show a bare ❓ and a question nobody can answer. Such a word
  // is asked as listen_tap instead: same options, same right answer, only the
  // prompt is the word's sound rather than a missing picture.
  const mode: QuizMode = question.mode === 'match_image' && correctWord && !wordVisual(correctWord)
    ? 'listen_tap'
    : question.mode

  // Shuffle once per question, not per render.
  const options = useMemo(
    () => (correctWord ? shuffleOnce([correctWord, ...distractorWords.slice(0, 3)]) : []),
    [correctWord, distractorWords]
  )

  // Auto-play the prompt as the card appears — except match_image, where
  // hearing the word would hand over the answer. Card remounts per question.
  useEffect(() => {
    if (mode === 'match_image') return
    const t = setTimeout(() => {
      if (correctWord) playClip(correctWord.audio_url)
      else if (correctLetter) playClip(correctLetter.audio_url)
    }, 420)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAnswer(id: string, isCorrect: boolean) {
    if (answeredRef.current) return
    answeredRef.current = true
    setSelected(id)
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    // The options' labels gain the result, but a label change isn't spoken:
    // say it once. Only after answering, so nothing gives the answer away.
    AccessibilityInfo.announceForAccessibility(
      isCorrect ? 'درست! آفرین' : correctWord ? `نادرست. جواب درست: ${correctWord.persian}` : 'نادرست'
    )
    if (isCorrect && correctWord) playClip(correctWord.audio_url)
    answerTimer.current = setTimeout(isCorrect ? onCorrect : onIncorrect, 950)
  }

  function speakPrompt() {
    if (correctWord) playClip(correctWord.audio_url)
    else if (correctLetter) playClip(correctLetter.audio_url)
  }

  /* ── FLASHCARD ── */
  if (mode === 'flashcard') {
    const visual = correctWord ? wordVisual(correctWord) : null
    return (
      <View style={styles.column}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={correctWord || correctLetter ? `${correctWord?.persian ?? correctLetter?.name_persian}، بشنو` : 'بشنو'}
          style={styles.fullWidth}
          onPress={speakPrompt}
        >
          {({ pressed }) => (
            <ClaySurface ramp={ramp} tone="soft" pressed={pressed} radius={radii.lg} faceStyle={styles.flashcard}>
              {correctWord ? (
                <>
                  {visual?.type === 'img' && <Image source={{ uri: visual.value }} style={styles.flashImage} contentFit="contain" />}
                  {visual?.type === 'emoji' && <Text style={styles.flashEmoji}>{visual.value}</Text>}
                  <Text style={[styles.flashWord, { color: ramp.ink }]}>{correctWord.persian}</Text>
                  <Text style={styles.flashLatin}>{correctWord.english}</Text>
                </>
              ) : correctLetter ? (
                <>
                  <Text style={[styles.flashLetter, { color: ramp.ink }]}>{correctLetter.character}</Text>
                  <Text style={[styles.flashWord, { color: ramp.ink }]}>{correctLetter.name_persian}</Text>
                  <Text style={styles.flashLatin}>{correctLetter.name_english}</Text>
                </>
              ) : null}
              <ListenHint ramp={ramp} label="ضربه بزن تا بشنوی" />
            </ClaySurface>
          )}
        </Pressable>
        <ClayButton ramp={ramp} label="بعدی" icon="chevron" iconPosition="end" onPress={() => {
          // Same one-shot guard: a double tap skipped the next card.
          if (answeredRef.current) return
          answeredRef.current = true
          onFlashcardNext()
        }} style={styles.fullWidth} />
      </View>
    )
  }

  if (!correctWord) return null

  /* ── MATCH IMAGE — show picture, pick the Persian word ── */
  if (mode === 'match_image') {
    const visual = wordVisual(correctWord)
    return (
      <View style={styles.column}>
        <ClaySurface ramp={ramp} tone="soft" radius={radii.lg} style={styles.fullWidth} faceStyle={styles.promptCard}>
          {visual?.type === 'img'
            ? <Image source={{ uri: visual.value }} style={styles.promptImage} contentFit="contain" />
            : <Text style={styles.promptEmoji}>{visual?.value}</Text>}
        </ClaySurface>
        <HostPrompt ramp={ramp} host={host} emoji={hostEmoji} text="این چه کلمه‌ای است؟" />
        <OptionGrid
          ramp={ramp}
          options={options} correctId={correctWord.id} selected={selected} feedback={feedback}
          render={(w) => ({ label: w.persian })}
          onSelect={handleAnswer}
        />
      </View>
    )
  }

  /* ── LISTEN & TAP — hear the word, pick it ── */
  if (mode === 'listen_tap') {
    return (
      <View style={styles.column}>
        {/* The phonics/placement speaker: a bright clay disc, ink glyph. */}
        <Pressable accessibilityRole="button" accessibilityLabel="دوباره بشنو" onPress={speakPrompt}>
          {({ pressed }) => (
            <ClaySurface ramp={ramp} tone="bright" pressed={pressed} radius={radii.pill} faceStyle={styles.speaker}>
              <Icon name="volume" color={ramp.ink} size={SPEAKER_ICON} strokeWidth={2.2} />
            </ClaySurface>
          )}
        </Pressable>
        <HostPrompt ramp={ramp} host={host} emoji={hostEmoji} text="کدام کلمه را شنیدی؟" />
        <OptionGrid
          ramp={ramp}
          options={options} correctId={correctWord.id} selected={selected} feedback={feedback}
          render={(w) => {
            const v = wordVisual(w)
            return {
              label: w.persian,
              emoji: v?.type === 'emoji' ? v.value : undefined,
              imageUrl: v?.type === 'img' ? v.value : undefined,
            }
          }}
          onSelect={handleAnswer}
        />
      </View>
    )
  }

  /* ── NAME IT — show Persian word, pick the matching picture ── */
  return (
    <View style={styles.column}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${correctWord.persian}، بشنو`} style={styles.fullWidth} onPress={speakPrompt}>
        {({ pressed }) => (
          <ClaySurface ramp={ramp} tone="soft" pressed={pressed} radius={radii.lg} faceStyle={styles.promptCard}>
            <Text style={[styles.flashWord, { color: ramp.ink }]}>{correctWord.persian}</Text>
            <ListenHint ramp={ramp} label="بشنو" />
          </ClaySurface>
        )}
      </Pressable>
      <HostPrompt ramp={ramp} host={host} emoji={hostEmoji} text="کدام تصویر درست است؟" />
      <OptionGrid
        ramp={ramp}
        options={options} correctId={correctWord.id} selected={selected} feedback={feedback}
        render={(w) => {
          const v = wordVisual(w)
          // Fall back to the word text when there's no picture, so an option is
          // never a blank white card (many words have no image/emoji).
          return {
            label: feedback !== null || !v ? w.persian : undefined,
            emoji: v?.type === 'emoji' ? v.value : undefined,
            imageUrl: v?.type === 'img' ? v.value : undefined,
            bigVisual: true,
          }
        }}
        onSelect={handleAnswer}
      />
    </View>
  )
}

function OptionGrid({ ramp, options, correctId, selected, feedback, render, onSelect }: {
  ramp: Ramp
  options: Word[]
  correctId: string
  selected: string | null
  feedback: 'correct' | 'incorrect' | null
  render: (w: Word) => { label?: string; emoji?: string; imageUrl?: string; bigVisual?: boolean }
  onSelect: (id: string, isCorrect: boolean) => void
}) {
  return (
    <View style={styles.grid}>
      {options.map((w, i) => {
        const { label, emoji, imageUrl, bigVisual } = render(w)
        const isCorrect = w.id === correctId
        const isSelected = selected === w.id
        const revealResult = feedback !== null && isSelected
        const showCorrect = feedback !== null && isCorrect && !isSelected
        // A picture-only option has no text for a screen reader, and naming
        // the picture would give the answer away, so it gets a neutral
        // number. (Web labels the right picture «گزینه درست» -- mobile
        // deliberately doesn't.) The result is announced only after answering.
        const result = revealResult ? (isCorrect ? '، درست' : '، نادرست') : showCorrect ? '، جواب درست' : ''
        const a11yLabel = `${label ?? `گزینه ${toPersianDigits(i + 1)}`}${result}`
        // Neutral (the room's soft clay) until answered; then the right one
        // is bright green, a wrong pick pale rose -- phonics' exact states.
        const state = revealResult ? (isCorrect ? 'right' : 'wrong') : showCorrect ? 'right' : null
        const face = state ? answerRamps[state] : ramp
        return (
          <Pressable accessibilityRole="button"
            key={w.id}
            disabled={feedback !== null}
            onPress={() => onSelect(w.id, isCorrect)}
            accessibilityLabel={a11yLabel}
            accessibilityState={{ disabled: feedback !== null, selected: isSelected }}
            style={styles.optionCell}
          >
            {({ pressed }) => (
              <ClaySurface
                ramp={face}
                tone={state === 'right' ? 'bright' : 'soft'}
                pressed={pressed && feedback === null}
                radius={radii.md}
                style={styles.fill}
                faceStyle={styles.option}
              >
                {imageUrl && <Image source={{ uri: imageUrl }} style={bigVisual ? styles.optionImageBig : styles.optionImage} contentFit="contain" />}
                {!imageUrl && emoji && <Text style={bigVisual ? styles.optionEmojiBig : styles.optionEmoji}>{emoji}</Text>}
                {/* No numberOfLines: a long answer wraps and the option grows. */}
                {label ? <Text style={[styles.optionLabel, { color: face.ink }]}>{label}</Text> : null}
                {state && <AnswerMark state={state} />}
              </ClaySurface>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

/** «ضربه بزن تا بشنوی» under a tappable prompt: the line speaker icon and
 *  the words, in the room's ink (the 🔊 emoji drew in its own colours). */
function ListenHint({ ramp, label }: { ramp: Ramp; label: string }) {
  return (
    <View style={styles.listenHint}>
      <Icon name="volume" color={ramp.ink} size={iconSize.inline} />
      <Text style={[styles.tapHint, { color: ramp.ink }]}>{label}</Text>
    </View>
  )
}

/**
 * The question, asked by the room's host: the host in its white disc at the
 * reading start and the question in a speech bubble beside it (a row, so it
 * mirrors under RTL). Used by QuizCard, the phonics quiz and placement, so
 * every child quiz asks the same way. The bubble text is the header; the
 * art is decorative. Never carries anything that hints at the answer.
 */
export function HostPrompt({ ramp, host, emoji, text, emotion = 'encouraging' }: {
  ramp: Ramp
  host?: string
  emoji?: string
  text: string
  emotion?: 'encouraging' | 'thinking' | 'happy'
}) {
  return (
    <View style={styles.prompt}>
      {host || emoji ? <HostAvatar ramp={ramp} size={PROMPT_HOST} character={host} emoji={emoji} emotion={emotion} /> : null}
      <View style={[styles.bubble, { borderColor: ramp.bright }]}>
        {host || emoji ? <View style={[styles.bubbleTail, { borderColor: ramp.bright }]} /> : null}
        <Text style={styles.questionText} accessibilityRole="header">{text}</Text>
      </View>
    </View>
  )
}

/** The ✓ / ✗ mark on an answered option, as a line icon in a disc of the
 *  answer ramp's deep stop (white clears >=7:1 there). Decorative: the
 *  option's label says «درست» / «نادرست». */
export function AnswerMark({ state }: { state: 'right' | 'wrong' }) {
  return (
    <View style={[styles.mark, { backgroundColor: answerRamps[state].deep }]}>
      <Icon name={state === 'right' ? 'check' : 'close'} color={ui.onDeep} size={16} strokeWidth={3} />
    </View>
  )
}

/**
 * The quiz screens' top bar -- a lesson, review and the phonics quiz: a close
 * disc (ScreenHeader's child back disc, holding ✕), the quiz's title, «۲ از ۶»
 * and a progress track in the room's ramp. It was three hand-copied twins
 * (phonics had no track at all). The track is a row, so under RTL it fills
 * from the reading start, like Home's learning-path tracks. `index` is the
 * 0-based question on screen; the track shows the questions already behind
 * the child.
 */
export function QuizTopBar({ title, index, total, ramp, onClose, style }: {
  title: string
  index: number
  total: number
  ramp: Ramp
  onClose: () => void
  /** Layout overrides, e.g. { paddingHorizontal: 0 } inside a padded view. */
  style?: StyleProp<ViewStyle>
}) {
  const n = Math.min(index + 1, Math.max(total, 1))
  return (
    <View style={[styles.topBar, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel="بستن" onPress={onClose} hitSlop={10}>
        {({ pressed }) => (
          <View style={[styles.closeDisc, pressed && styles.pressed]}>
            <Icon name="close" color={scenery.ink} size={iconSize.control} strokeWidth={2.5} />
          </View>
        )}
      </Pressable>
      <View style={styles.topMain}>
        <View style={styles.topRow}>
          {/* Wraps rather than «…»: a lesson's name is the screen's title. */}
          <Text style={styles.topTitle} accessibilityRole="header">{title}</Text>
          <Text
            style={[styles.counter, { color: ramp.ink }]}
            accessibilityLabel={`سؤال ${toPersianDigits(n)} از ${toPersianDigits(total)}`}
          >
            {toPersianDigits(n)} از {toPersianDigits(total)}
          </Text>
        </View>
        {/* The shared bar (Clay.tsx): a neutral warm track, not ramp.bright
            -- at question 1 the bright track with an empty fill read as a
            full, finished bar (iOS Simulator, 2026-09-28). The questions
            already behind the child; the counter above carries the words. */}
        <ProgressTrack value={Math.min(index, total)} total={Math.max(total, 1)} ramp={ramp} height={10} decorative />
      </View>
    </View>
  )
}

// Home's rhythm between sibling items: 12, between the scale's 8 and 16.
const GAP = spacing.sm + spacing.xs
const PROMPT_HOST = 52
// The listen prompt's glyph in its 104pt disc.
const SPEAKER_ICON = 48

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: GAP, paddingHorizontal: spacing.md, paddingBottom: GAP },
  closeDisc: {
    width: ui.hit, height: ui.hit, borderRadius: radii.pill, backgroundColor: ui.surface,
    borderWidth: 2, borderColor: ui.divider, alignItems: 'center', justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  topMain: { flex: 1, gap: spacing.xs + 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  topTitle: { flex: 1, fontFamily: fonts.display, fontSize: textSize.small, color: scenery.ink, textAlign: textStart },
  counter: { fontFamily: fonts.bold, fontSize: textSize.caption },
  column: { width: '100%', alignItems: 'center', gap: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
  fill: { flex: 1 },
  flashcard: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  flashImage: { width: 170, height: 170 },
  // Emoji: no fixed lineHeight. The old ~1.15x boxes could cut them on
  // Android; they draw in the system emoji font, so its own height is right
  // (naturalLineHeight is Vazirmatn's metric, not the emoji font's).
  flashEmoji: { fontSize: 96 },
  // naturalLineHeight: the letter being taught can carry marks.
  flashLetter: { fontSize: 84, lineHeight: naturalLineHeight(84), fontFamily: fonts.bold },
  flashWord: { fontSize: 40, lineHeight: naturalLineHeight(40), fontFamily: fonts.bold, textAlign: 'center' },
  // muted is fine here: the clay face is the ramp's near-white soft stop.
  flashLatin: { fontSize: textSize.small, fontFamily: fonts.regular, color: ui.textMuted, textAlign: 'center' },
  // The room's ink, not the old #d97706 (~3:1 on white).
  listenHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  tapHint: { ...textStyles.label },
  promptCard: { minHeight: 170, alignItems: 'center', justifyContent: 'center', padding: spacing.md, gap: spacing.xs },
  promptImage: { width: 160, height: 160 },
  promptEmoji: { fontSize: 100 },
  speaker: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: GAP, alignSelf: 'stretch' },
  // A white speech bubble rimmed in the room's bright stop; its tail points
  // back at the host (logical `start`, so it follows RTL).
  bubble: {
    flex: 1, minHeight: PROMPT_HOST, justifyContent: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: shape.bubble, borderWidth: 2, backgroundColor: ui.surface,
  },
  bubbleTail: {
    position: 'absolute', start: -7, top: '50%', marginTop: -6, width: 12, height: 12,
    backgroundColor: ui.surface, borderStartWidth: 2, borderBottomWidth: 2,
    // The start+bottom corner turned to face the host: clockwise under LTR,
    // counter-clockwise under RTL (where `start` is the right edge).
    transform: [{ rotate: I18nManager.isRTL ? '-45deg' : '45deg' }],
  },
  // scenery.ink, like every other child heading.
  questionText: { ...textStyles.sectionTitle, textAlign: textStart },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, width: '100%' },
  // 40% + flexGrow (ModuleCard's rule): always two per row, and the row
  // stretches both options to the taller one (`fill` + the face's flex: 1).
  optionCell: { width: '40%', flexGrow: 1 },
  // Big, calm targets: 88pt, the label at cardTitle size.
  option: {
    flex: 1, minHeight: 88, alignItems: 'center', justifyContent: 'center',
    padding: spacing.sm + spacing.xs, gap: spacing.xs,
  },
  optionImage: { width: 54, height: 54 },
  optionImageBig: { width: 76, height: 76 },
  optionEmoji: { fontSize: 34 },
  optionEmojiBig: { fontSize: 56 },
  optionLabel: { fontSize: textSize.cardTitle, lineHeight: naturalLineHeight(textSize.cardTitle), fontFamily: fonts.bold, textAlign: 'center' },
  mark: { width: 26, height: 26, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
})
