import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import type { Letter, Word } from '@koodakbook/shared'
import { wordEmoji } from '@koodakbook/shared'
import { mediaUrl } from '@/lib/media'
import { playClip } from '@/lib/sound'
import { colors, fonts } from '@/lib/theme'

// Mobile port of web's QuizCard (components/child/QuizCard.tsx) — same four
// modes, same reveal-then-advance rhythm, minus the web-only sound effects.
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
}

function wordVisual(word: Word): { type: 'img' | 'emoji'; value: string } | null {
  const img = mediaUrl(word.image_url)
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

export default function QuizCard({ question, onCorrect, onIncorrect, onFlashcardNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const { mode, correctWord, correctLetter, distractorWords = [] } = question

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
    if (feedback !== null) return
    setSelected(id)
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect && correctWord) playClip(correctWord.audio_url)
    setTimeout(isCorrect ? onCorrect : onIncorrect, 950)
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
        <Pressable style={styles.flashcard} onPress={speakPrompt}>
          {correctWord ? (
            <>
              {visual?.type === 'img' && <Image source={{ uri: visual.value }} style={styles.flashImage} contentFit="contain" />}
              {visual?.type === 'emoji' && <Text style={styles.flashEmoji}>{visual.value}</Text>}
              <Text style={styles.flashWord}>{correctWord.persian}</Text>
              <Text style={styles.flashLatin}>{correctWord.english}</Text>
            </>
          ) : correctLetter ? (
            <>
              <Text style={styles.flashLetter}>{correctLetter.character}</Text>
              <Text style={styles.flashWord}>{correctLetter.name_persian}</Text>
              <Text style={styles.flashLatin}>{correctLetter.name_english}</Text>
            </>
          ) : null}
          <Text style={styles.tapHint}>🔊 ضربه بزن تا بشنوی</Text>
        </Pressable>
        <Pressable style={styles.nextButton} onPress={onFlashcardNext}>
          <Text style={styles.nextText}>بعدی ←</Text>
        </Pressable>
      </View>
    )
  }

  if (!correctWord) return null

  /* ── MATCH IMAGE — show picture, pick the Persian word ── */
  if (mode === 'match_image') {
    const visual = wordVisual(correctWord)
    return (
      <View style={styles.column}>
        <View style={styles.promptCard}>
          {visual?.type === 'img'
            ? <Image source={{ uri: visual.value }} style={styles.promptImage} contentFit="contain" />
            : <Text style={styles.promptEmoji}>{visual?.value ?? '❓'}</Text>}
        </View>
        <Text style={styles.questionText}>این چه کلمه‌ای است؟</Text>
        <OptionGrid
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
        <Pressable style={styles.speakerButton} onPress={speakPrompt}>
          <Text style={{ fontSize: 44 }}>🔊</Text>
        </Pressable>
        <Text style={styles.questionText}>کدام کلمه را شنیدی؟</Text>
        <OptionGrid
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
      <Pressable style={styles.promptCard} onPress={speakPrompt}>
        <Text style={styles.flashWord}>{correctWord.persian}</Text>
        <Text style={styles.tapHint}>🔊 بشنو</Text>
      </Pressable>
      <Text style={styles.questionText}>کدام تصویر درست است؟</Text>
      <OptionGrid
        options={options} correctId={correctWord.id} selected={selected} feedback={feedback}
        render={(w) => {
          const v = wordVisual(w)
          return {
            label: feedback !== null ? w.persian : undefined,
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

function OptionGrid({ options, correctId, selected, feedback, render, onSelect }: {
  options: Word[]
  correctId: string
  selected: string | null
  feedback: 'correct' | 'incorrect' | null
  render: (w: Word) => { label?: string; emoji?: string; imageUrl?: string; bigVisual?: boolean }
  onSelect: (id: string, isCorrect: boolean) => void
}) {
  return (
    <View style={styles.grid}>
      {options.map((w) => {
        const { label, emoji, imageUrl, bigVisual } = render(w)
        const isCorrect = w.id === correctId
        const isSelected = selected === w.id
        const revealResult = feedback !== null && isSelected
        const showCorrect = feedback !== null && isCorrect && !isSelected
        return (
          <Pressable
            key={w.id}
            disabled={feedback !== null}
            onPress={() => onSelect(w.id, isCorrect)}
            style={[
              styles.option,
              revealResult && (isCorrect ? styles.optionRight : styles.optionWrong),
              showCorrect && styles.optionRight,
            ]}
          >
            {imageUrl && <Image source={{ uri: imageUrl }} style={bigVisual ? styles.optionImageBig : styles.optionImage} contentFit="contain" />}
            {!imageUrl && emoji && <Text style={bigVisual ? styles.optionEmojiBig : styles.optionEmoji}>{emoji}</Text>}
            {label ? <Text style={styles.optionLabel}>{label}</Text> : null}
            {(revealResult || showCorrect) && (
              <Text style={{ fontSize: 16 }}>{isCorrect ? '✅' : '❌'}</Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  column: { width: '100%', alignItems: 'center', gap: 16 },
  flashcard: {
    width: '100%', backgroundColor: colors.card, borderRadius: 22, padding: 24,
    alignItems: 'center', gap: 8,
  },
  flashImage: { width: 170, height: 170 },
  flashEmoji: { fontSize: 96, lineHeight: 110 },
  flashLetter: { fontSize: 84, lineHeight: 100, fontFamily: fonts.bold, color: colors.text },
  flashWord: { fontSize: 40, fontFamily: fonts.bold, color: colors.text },
  flashLatin: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted },
  tapHint: { fontSize: 12, fontFamily: fonts.regular, color: '#d97706', marginTop: 4 },
  nextButton: {
    width: '100%', backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  nextText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  promptCard: {
    width: '100%', minHeight: 170, backgroundColor: colors.card, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', padding: 16, gap: 4,
  },
  promptImage: { width: 160, height: 160 },
  promptEmoji: { fontSize: 100, lineHeight: 116 },
  speakerButton: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  questionText: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  option: {
    width: '48%', flexGrow: 1, minHeight: 76, backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center', padding: 10, gap: 4,
  },
  optionRight: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  optionWrong: { borderColor: colors.danger, backgroundColor: '#fef2f2' },
  optionImage: { width: 54, height: 54 },
  optionImageBig: { width: 76, height: 76 },
  optionEmoji: { fontSize: 34, lineHeight: 40 },
  optionEmojiBig: { fontSize: 56, lineHeight: 64 },
  optionLabel: { fontSize: 19, fontFamily: fonts.bold, color: colors.text },
})
