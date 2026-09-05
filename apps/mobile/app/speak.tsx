import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, Word } from '@koodakbook/shared'
import { toPersianDigits, wordEmoji } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { playClip } from '@/lib/sound'
import { mediaUrl } from '@/lib/media'
import { colors, fonts } from '@/lib/theme'

/**
 * تمرین گفتن (web: /child/speak) — listen and repeat. Web grades pronunciation
 * with the browser's Web Speech API; React Native has no in-Expo-Go equivalent,
 * so this is web's graceful "unsupported" path: hear the word, say it aloud,
 * tap «گفتم» to confirm — which records a productive-track rep (the point of
 * the module). Automatic pronunciation checking can come with a dev build.
 */
export default function Speak() {
  const insets = useSafeAreaInsets()
  const [words, setWords] = useState<Word[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [childId, setChildId] = useState('')
  const [said, setSaid] = useState(false)

  useEffect(() => {
    async function load() {
      const activeId = await getActiveChildId()
      if (activeId) setChildId(activeId)
      const res = await api.get<Word[]>('/api/words')
      const all = res.data ?? []
      // Prefer words with a real image or, failing that, an emoji, so the
      // child always has a visual cue — same test QuizCard uses, not emoji-only.
      const withVisual = all.filter((w) => w.image_url || wordEmoji(w.english))
      setWords((withVisual.length >= 8 ? withVisual : all).slice(0, 20))
    }
    load()
  }, [])

  const word = words?.[idx]

  // Say each word as it appears; the card stays tappable for replay.
  useEffect(() => {
    if (!word) return
    const t = setTimeout(() => playClip(word.audio_url), 350)
    return () => clearTimeout(t)
  }, [word?.id])

  if (!words) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }
  if (words.length === 0 || !word) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>کلمه‌ای نیست</Text>
      </View>
    )
  }

  const image = mediaUrl(word.image_url)
  const emoji = wordEmoji(word.english)

  function confirmSaid() {
    if (said || !word) return
    setSaid(true)
    // Productive-track rep — the child produced the word (web posts this on a
    // recognition match; here it's self-reported).
    if (childId) {
      void api.post('/api/progress/word', {
        child_id: childId, word_id: word.id, status: 'practiced', track: 'productive',
      })
    }
  }

  function nextWord() {
    setSaid(false)
    setIdx((i) => (i + 1) % (words?.length ?? 1))
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>تمرین گفتن 🎤</Text>
          <Text style={styles.subtitle}>کلمه {toPersianDigits(idx + 1)} از {toPersianDigits(words.length)}</Text>
        </View>
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>اول گوش کن، بعد بلند تکرار کن 🗣️</Text>
      </View>

      {/* Word card — tap to hear again */}
      <Pressable style={styles.card} onPress={() => playClip(word.audio_url)}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage} contentFit="contain" />
        ) : emoji ? (
          <Text style={styles.cardEmoji}>{emoji}</Text>
        ) : null}
        <Text style={styles.cardWord}>{word.persian}</Text>
        <Text style={styles.cardLatin}>{word.english}</Text>
        <Text style={styles.cardListen}>🔊 اول گوش کن</Text>
      </Pressable>

      {said ? (
        <View style={styles.feedback}>
          <Text style={{ fontSize: 44 }}>🌟</Text>
          <Text style={styles.feedbackText}>آفرین! تمرین کردی</Text>
        </View>
      ) : (
        <Pressable style={styles.sayButton} onPress={confirmSaid}>
          <Text style={styles.sayButtonText}>🎤 گفتم!</Text>
        </Pressable>
      )}

      <Pressable style={styles.nextButton} onPress={nextWord}>
        <Text style={styles.nextButtonText}>کلمه بعدی ←</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, gap: 16, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty: { color: colors.muted, fontFamily: fonts.regular },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  hint: { backgroundColor: '#fce7f3', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  hintText: { fontSize: 13, fontFamily: fonts.medium, color: '#9d174d', textAlign: 'center' },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 20,
    padding: 24, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardEmoji: { fontSize: 72, lineHeight: 84 },
  cardImage: { width: 112, height: 112 },
  cardWord: { fontSize: 44, fontFamily: fonts.bold, color: colors.text },
  cardLatin: { fontSize: 16, fontFamily: fonts.regular, color: colors.muted },
  cardListen: { fontSize: 12, fontFamily: fonts.regular, color: '#b45309', marginTop: 4 },
  feedback: { alignItems: 'center', gap: 4 },
  feedbackText: { fontSize: 17, fontFamily: fonts.bold, color: colors.success },
  sayButton: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: '#ec4899',
    alignItems: 'center', justifyContent: 'center',
  },
  sayButtonText: { color: '#fff', fontSize: 20, fontFamily: fonts.bold },
  nextButton: {
    width: '100%', maxWidth: 360, backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center', marginTop: 'auto',
  },
  nextButtonText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
})
