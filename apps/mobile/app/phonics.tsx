import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  PHONICS_CONSONANTS, SHORT_VOWELS, phonicsAudioUrl, phonicsSyllables,
  type Syllable,
} from '@koodakbook/shared'
import { playClip, stopClip } from '@/lib/sound'
import { playSuccess, playTap } from '@/lib/uiSound'
import { shuffle } from '@/lib/math'
import CelebrationOverlay from '@/components/CelebrationOverlay'
import {
  answerRamps, clay, colors, fonts, page, radii, ramps, scenery, spacing, textSize, tones, textStart, naturalLineHeight, ui,
  type Ramp,
} from '@/lib/theme'
import ScreenBackground from '@/components/ScreenBackground'
import BottomNav from '@/components/BottomNav'
import { ClayButton, ClaySurface, SectionHeading } from '@/components/Clay'
import { AnswerMark, HostPrompt, QuizTopBar } from '@/components/QuizCard'
import { Icon } from '@/components/Icon'
import { RoomBand, RoomDoneCard } from '@/components/RoomScene'

/* صداها (zebar/zir/pish) — ported from web /child/phonics. Learn: tap any
 * syllable, see it big on the stage and hear its blend. Quiz: hear one, pick
 * it from four. Web's fly-together merge animation is simplified to a stage
 * reveal; the audio timing (the actual lesson) is identical. */

const DEMO = 'ب'
// zebar/zir/pish tones -- ported from web's VOWEL_TONES (clay.tsx):
// rose/sky/violet. Dark `ink` text sits on the bright `fill`, never white --
// the previous white-on-#FB7185 pairing measured ~2.3:1, under the 4.5:1 AA
// floor (2026-09-20 audit, Critical #1).
const VOWEL_TONES: Record<string, keyof typeof tones> = { zebar: 'rose', zir: 'sky', pish: 'violet' }

/** A `tones` entry as a clay ramp: fill is the bright face, edge the band
 *  under it, ink the text (the pairs tones.* already clears for AA). */
function toneRamp(t: (typeof tones)[keyof typeof tones]): Ramp {
  return { deep: t.edge, bright: t.fill, soft: t.fill, ink: t.ink }
}

// Quiz answer states: theme's answerRamps, shared with QuizCard (lessons,
// review) since 2026-09-26. Correct = the lessons (green) ramp; a wrong pick
// a pale rose face with the rose tone's rim. Both also carry a ✅ / ❌ mark,
// so the state never rests on colour alone.
const RIGHT_RAMP: Ramp = answerRamps.right
const WRONG_RAMP: Ramp = answerRamps.wrong

export default function PhonicsPage() {
  const insets = useSafeAreaInsets()
  const all = useMemo(() => phonicsSyllables(), [])
  const [phase, setPhase] = useState<'learn' | 'quiz' | 'done'>('learn')
  const [stage, setStage] = useState<{ text: string; markName: string } | null>(null)
  // A syllable still playing when the child leaves must not follow them.
  useEffect(() => () => stopClip(), [])

  function demo(text: string, markName: string, slug: string) {
    setStage({ text, markName })
    playClip(phonicsAudioUrl(slug))
  }

  if (phase === 'quiz') {
    return <PhonicsQuiz all={all} onDone={() => setPhase('done')} onExit={() => setPhase('learn')} />
  }

  if (phase === 'done') {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <CelebrationOverlay />
          {/* The lesson and review done screens' card (RoomDoneCard): the
              room's stage, the verdict in its ink. The sounds room has no
              host (web's kit.tsx), so سیمرغ, the app's guide, cheers. */}
          <RoomDoneCard
            ramp={ramps.phonics}
            character="simorgh"
            title="آفرین!"
            body="حالا می‌تونی حرف‌ها رو بخونی!"
          />
          <View style={styles.doneActions}>
            <ClayButton ramp={ramps.phonics} label="یک بار دیگه" emoji="🔁" onPress={() => setPhase('quiz')} />
            <ClayButton ramp={ramps.phonics} tone="soft" label="برگشت به خانه" emoji="🏠" onPress={() => goBack('/home')} />
          </View>
        </View>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 92 }]}
      stickyHeaderIndices={[1]}
    >
      {/* The sounds room's band (components/RoomScene.tsx): Home's world
          tinted orange, Home's room name, and the room's 🎵 disc on the
          hills (no host here, Home's fallback). Full-bleed. */}
      <View style={styles.bandWrap}>
        <RoomBand
          ramp={ramps.phonics}
          emoji="🎵"
          title="صداها"
          subtitle="زبر، زیر، پیش — ضربه بزن، ببین و گوش کن!"
          topInset={insets.top}
        />
      </View>

      {/* The stage — sticky so every tap below plays here in view. The band
          behind it is the page's solid base: a transparent band would let the
          tiles scrolling underneath show through around the card. */}
      <View style={styles.stageBand}>
        <ClaySurface ramp={ramps.phonics} tone="soft" radius={radii.md} faceStyle={styles.stage}>
          {stage ? (
            <>
              <Text style={styles.stageText}>{stage.text}</Text>
              <Text style={styles.stageMark}>{stage.markName}</Text>
            </>
          ) : (
            <Text style={styles.stageHint}>روی یک هجا ضربه بزن تا ببینی چطور ساخته می‌شود</Text>
          )}
        </ClaySurface>
      </View>

      <SectionHeading title="حرکت‌ها" />
      <View style={styles.vowelRow}>
        {SHORT_VOWELS.map((v) => {
          const syll = DEMO + v.mark
          const ramp = toneRamp(tones[VOWEL_TONES[v.key] ?? 'amber'])
          return (
            <Pressable
              key={v.key}
              style={styles.vowelCell}
              onPress={() => demo(syll, v.namePersian, 'b' + v.latin)}
              accessibilityRole="button"
              accessibilityLabel={`${syll}، ${v.namePersian}`}
            >
              {({ pressed }) => (
                <ClaySurface ramp={ramp} tone="bright" pressed={pressed} radius={radii.md} style={styles.fill} faceStyle={styles.vowelTile}>
                  <Text style={[styles.vowelSyll, { color: ramp.ink }]}>{syll}</Text>
                  <Text style={[styles.vowelName, { color: ramp.ink }]}>{v.namePersian}</Text>
                  <Text style={[styles.vowelLatin, { color: ramp.ink }]}>{v.latin}</Text>
                </ClaySurface>
              )}
            </Pressable>
          )
        })}
      </View>

      {SHORT_VOWELS.map((v) => (
        <View key={v.key} style={styles.syllSection}>
          <Text style={styles.section} accessibilityRole="header">
            با {v.namePersian} <Text style={styles.sectionLatin}>({v.latin})</Text>
          </Text>
          <View style={styles.syllGrid}>
            {PHONICS_CONSONANTS.map((c) => {
              const text = c.ch + v.mark
              const slug = c.latin + v.latin
              return (
                <Pressable
                  key={slug}
                  style={styles.syllCell}
                  onPress={() => demo(text, v.namePersian, slug)}
                  accessibilityRole="button"
                  accessibilityLabel={text}
                >
                  {({ pressed }) => (
                    <ClaySurface ramp={ramps.phonics} tone="soft" pressed={pressed} radius={radii.md} edge={clay.edgeSm} faceStyle={styles.syllTile}>
                      <Text style={styles.syllText}>{text}</Text>
                      <Text style={styles.syllLatin}>{slug}</Text>
                    </ClaySurface>
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}

      <ClayButton ramp={ramps.phonics} label="بریم تمرین" emoji="🎧" onPress={() => setPhase('quiz')} />
    </ScrollView>
    <BottomNav />
    </ScreenBackground>
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
  // `picked` is state, so two taps in one frame both saw null: both answered
  // and both scheduled an advance, skipping a question (QuizCard's bug and
  // fix). The ref flips at once; it resets with each new question.
  const answeredRef = useRef(false)
  const doneRef = useRef(false)
  // The post-answer pause. Cleared on unmount: leaving the quiz (back) inside
  // the 900ms used to still fire it, so a last-question answer followed by
  // back jumped to the done screen, and earlier ones set state on an
  // unmounted quiz.
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current) }, [])
  const q = questions[idx]

  useEffect(() => {
    const t = setTimeout(() => playClip(phonicsAudioUrl(q.correct.slug)), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  function choose(slug: string) {
    if (picked || answeredRef.current) return
    answeredRef.current = true
    setPicked(slug)
    const right = slug === q.correct.slug
    if (right) playSuccess()
    else playTap()
    // The options' labels gain the result, but a label change isn't spoken:
    // say it once, only after answering (QuizCard's wording).
    AccessibilityInfo.announceForAccessibility(right ? 'درست! آفرین' : `نادرست. جواب درست: ${q.correct.text}`)
    advanceRef.current = setTimeout(() => {
      advanceRef.current = null
      if (idx >= questions.length - 1) {
        if (!doneRef.current) { doneRef.current = true; onDone() }
      } else {
        answeredRef.current = false
        setPicked(null)
        setIdx((i) => i + 1)
      }
    }, 900)
  }

  return (
    <ScreenBackground variant="warm">
    <View style={[styles.quiz, { paddingTop: insets.top + GAP, paddingBottom: insets.bottom + spacing.lg }]}>
      {/* The lesson and review quiz bar: ✕ back to the syllables, «۲ از ۶»
          and the progress track (this quiz had no track). */}
      <QuizTopBar
        title="گوش کن و انتخاب کن"
        index={idx}
        total={questions.length}
        ramp={ramps.phonics}
        onClose={onExit}
        style={styles.flushHeader}
      />

      <View style={styles.quizBody}>
        <Pressable accessibilityRole="button" accessibilityLabel="دوباره بشنو" onPress={() => playClip(phonicsAudioUrl(q.correct.slug))}>
          {({ pressed }) => (
            <ClaySurface ramp={ramps.phonics} tone="bright" pressed={pressed} radius={radii.pill} faceStyle={styles.speaker}>
              <Icon name="volume" color={ramps.phonics.ink} size={46} strokeWidth={2.2} />
            </ClaySurface>
          )}
        </Pressable>
        {/* Asked from the room's disc, like every child quiz (HostPrompt). */}
        <HostPrompt ramp={ramps.phonics} emoji="🎵" text="کدام را شنیدی؟" />
        <View style={styles.quizGrid}>
          {q.options.map((opt) => {
            const isCorrect = opt.slug === q.correct.slug
            const show = picked !== null
            // Only after an answer: the right one turns green with ✅, a wrong
            // pick pale rose with ❌. Before that every option looks (and
            // reads) the same.
            const state = !show ? null : isCorrect ? 'right' : opt.slug === picked ? 'wrong' : null
            const ramp = state === 'right' ? RIGHT_RAMP : state === 'wrong' ? WRONG_RAMP : ramps.phonics
            return (
              <Pressable
                key={opt.slug}
                style={styles.optCell}
                onPress={() => choose(opt.slug)}
                disabled={show}
                accessibilityState={{ disabled: show, selected: opt.slug === picked }}
                accessibilityRole="button"
                accessibilityLabel={state === 'right' ? `${opt.text}، درست` : state === 'wrong' ? `${opt.text}، نادرست` : opt.text}
              >
                {({ pressed }) => (
                  <ClaySurface
                    ramp={ramp}
                    tone={state === 'right' ? 'bright' : 'soft'}
                    pressed={pressed && !show}
                    radius={radii.md}
                    faceStyle={styles.opt}
                  >
                    <Text style={[styles.optText, { color: ramp.ink }]}>{opt.text}</Text>
                    {state ? (
                      <View style={styles.optMark}><AnswerMark state={state} /></View>
                    ) : null}
                  </ClaySurface>
                )}
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
    </ScreenBackground>
  )
}

// Home's rhythm between sibling items: 12, between the scale's 8 and 16.
const GAP = spacing.sm + spacing.xs

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm + spacing.xs, padding: spacing.lg },
  // spacing.md: Home's (and every list's) side edge; was 20 + the header's own 20.
  content: { paddingHorizontal: spacing.md, gap: GAP },
  flushHeader: { paddingHorizontal: 0 },
  // Full-bleed: undo the content's side padding for the band.
  bandWrap: { marginHorizontal: -spacing.md },
  fill: { flex: 1 },
  stageBand: { backgroundColor: page.base, paddingVertical: spacing.sm },
  // minHeight = padding 24 + glyph + gap 2 + mark name, so the first tap (hint
  // -> glyph) doesn't push the whole screen down.
  stage: {
    minHeight: 24 + naturalLineHeight(56) + 2 + naturalLineHeight(textSize.caption),
    alignItems: 'center', justifyContent: 'center', padding: GAP, gap: 2,
  },
  // naturalLineHeight (theme.ts): these glyphs carry the vowel marks being taught.
  stageText: { fontSize: 56, fontFamily: fonts.bold, color: ramps.phonics.ink, lineHeight: naturalLineHeight(56) },
  stageMark: { fontSize: textSize.caption, fontFamily: fonts.medium, color: colors.text },
  stageHint: { fontSize: textSize.caption, fontFamily: fonts.regular, color: colors.text, textAlign: 'center' },
  // Same face as SectionHeading's title, kept as a Text so the Latin vowel
  // name can sit inline in a smaller size.
  section: { fontSize: textSize.cardTitle, fontFamily: fonts.display, color: scenery.ink, textAlign: textStart },
  sectionLatin: { fontSize: textSize.caption, fontFamily: fonts.regular, color: colors.text },
  vowelRow: { flexDirection: 'row', gap: GAP },
  vowelCell: { flex: 1 },
  vowelTile: { flex: 1, padding: GAP, alignItems: 'center', gap: 2, minHeight: 108, justifyContent: 'center' },
  vowelSyll: { fontSize: 40, fontFamily: fonts.bold, lineHeight: naturalLineHeight(40) },
  vowelName: { fontSize: textSize.caption, fontFamily: fonts.medium },
  // Full ink, no opacity: the old 0.75 fade let the Latin line drop under AA
  // on the rose/violet faces.
  vowelLatin: { fontSize: textSize.micro, fontFamily: fonts.regular },
  syllSection: { gap: GAP },
  syllGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  syllCell: { width: '22.7%', flexGrow: 1 },
  syllTile: { paddingVertical: spacing.sm, alignItems: 'center', gap: 1 },
  syllText: { fontSize: 26, fontFamily: fonts.bold, color: ramps.phonics.ink, lineHeight: naturalLineHeight(26) },
  syllLatin: { fontSize: textSize.micro, fontFamily: fonts.regular, color: ui.textMuted },
  quiz: { flex: 1, paddingHorizontal: spacing.md, gap: GAP },
  quizBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  speaker: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  quizGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, width: '100%' },
  optCell: { width: '48%', flexGrow: 1 },
  opt: { paddingVertical: spacing.md, alignItems: 'center' },
  optText: { fontSize: 34, fontFamily: fonts.bold, lineHeight: naturalLineHeight(34) },
  // The answer mark sits in the tile's top start corner (logical `start`,
  // so it follows RTL), clear of the centred glyph: no layout shift.
  optMark: { position: 'absolute', top: spacing.sm, start: spacing.sm },
  doneActions: { width: '100%', maxWidth: 360, gap: spacing.sm + spacing.xs, marginTop: spacing.sm },
})
