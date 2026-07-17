import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter, CharacterLine, Child, Word } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { characterEmoji } from '@/lib/characterEmoji'
import { mediaUrl } from '@/lib/media'
import { playClip } from '@/lib/sound'
import { shuffle } from '@/lib/math'
import { colors, fonts } from '@/lib/theme'

/* بازی حافظه — ported from web /child/games/memory. Data-driven off the word
 * catalog; each flip speaks the word so pre-readers play by sound. Optional
 * ?host=<slug> lets a friend present the game (game_open / praise lines). */

const PAIRS = 6

interface Card {
  key: string
  wordId: string
  persian: string
  english: string
  audio: string | null
  image: string | null
}

function pickLine(host: AppCharacter | null, trigger: string): CharacterLine | null {
  const matches = (host?.lines ?? []).filter((l) => l.trigger === trigger)
  return matches.length ? matches[Math.floor(Math.random() * matches.length)] : null
}

export default function MemoryGamePage() {
  const { host: hostSlug } = useLocalSearchParams<{ host?: string }>()
  const [words, setWords] = useState<Word[] | null>(null)
  const [host, setHost] = useState<AppCharacter | null>(null)
  const [round, setRound] = useState(0)

  useEffect(() => {
    async function load() {
      if (hostSlug) {
        api.get<AppCharacter[]>('/api/characters').then((r) => {
          const h = r.data?.find((c) => c.slug === hostSlug) ?? null
          setHost(h)
          const open = pickLine(h, 'game_open') ?? pickLine(h, 'greeting')
          if (open?.audio_url) setTimeout(() => playClip(open.audio_url), 600)
        })
      }
      const childId = await getActiveChildId()
      const [wordsRes, childRes] = await Promise.all([
        api.get<Word[]>('/api/words'),
        api.get<Child[]>('/api/children'),
      ])
      const child = childRes.data?.find((c) => c.id === childId)
      const level = child?.level ?? 1
      // Short, level-appropriate words read best on small cards.
      const pool = (wordsRes.data ?? []).filter((w) => w.stage <= level && w.persian.length <= 6)
      setWords(pool.length >= PAIRS ? pool : (wordsRes.data ?? []))
    }
    load()
  }, [hostSlug])

  if (!words) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }
  return <Board key={round} words={words} host={host} onReplay={() => setRound((r) => r + 1)} />
}

function Board({ words, host, onReplay }: { words: Word[]; host: AppCharacter | null; onReplay: () => void }) {
  const insets = useSafeAreaInsets()
  const cards = useMemo<Card[]>(() => {
    const picked = shuffle(words).slice(0, PAIRS)
    return shuffle(
      picked.flatMap((w) =>
        ([0, 1] as const).map((i) => ({
          key: `${w.id}-${i}`, wordId: w.id, persian: w.persian, english: w.english,
          audio: w.audio_url, image: mediaUrl(w.image_url),
        }))
      )
    )
  }, [words])

  const [open, setOpen] = useState<string[]>([])
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState(0)
  const done = matched.size === PAIRS

  useEffect(() => {
    if (!done) return
    const praise = pickLine(host, 'praise')
    if (praise?.audio_url) setTimeout(() => playClip(praise.audio_url), 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function flip(card: Card) {
    if (open.length === 2 || open.includes(card.key) || matched.has(card.wordId)) return
    playClip(card.audio)
    const next = [...open, card.key]
    setOpen(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next.map((k) => cards.find((c) => c.key === k)!)
      if (a.wordId === b.wordId) {
        setTimeout(() => { setMatched((s) => new Set(s).add(a.wordId)); setOpen([]) }, 450)
      } else {
        setTimeout(() => setOpen([]), 950)
      }
    }
  }

  if (done) {
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 64 }}>{host ? characterEmoji(host) : '🎉'}</Text>
        <Text style={styles.doneTitle}>همه را پیدا کردی! 🎉</Text>
        <Text style={styles.doneSub}>با {toPersianDigits(moves)} حرکت — عالی بود!</Text>
        <Pressable style={styles.primaryButton} onPress={onReplay}>
          <Text style={styles.primaryText}>دوباره بازی کن 🔁</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>برگشت 🏠</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>بازی حافظه 🃏</Text>
          <Text style={styles.subtitle}>جفت هر کلمه را پیدا کن</Text>
        </View>
        {host && <Text style={{ fontSize: 28 }}>{characterEmoji(host)}</Text>}
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusText}>جفت‌ها: {toPersianDigits(matched.size)} از {toPersianDigits(PAIRS)}</Text>
        <Text style={styles.statusText}>حرکت: {toPersianDigits(moves)}</Text>
      </View>

      <View style={styles.grid}>
        {cards.map((card) => {
          const isOpen = open.includes(card.key) || matched.has(card.wordId)
          const isMatched = matched.has(card.wordId)
          return (
            <Pressable key={card.key} style={styles.cardSlot} onPress={() => flip(card)}>
              {isOpen ? (
                <View style={[styles.cardFace, isMatched ? styles.cardMatched : styles.cardOpen]}>
                  {card.image && <Image source={{ uri: card.image }} style={styles.cardImage} contentFit="cover" />}
                  <Text style={[styles.cardWord, card.image && { fontSize: 14 }]} numberOfLines={1}>{card.persian}</Text>
                  <Text style={styles.cardLatin} numberOfLines={1}>{card.english}</Text>
                </View>
              ) : (
                <View style={[styles.cardFace, styles.cardBack]}>
                  <Text style={{ fontSize: 28 }}>🌟</Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.hint}>روی کارت‌ها بزن، کلمه را بشنو و جفتش را پیدا کن</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  statusText: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardSlot: { width: '31.5%', flexGrow: 1, aspectRatio: 0.78 },
  cardFace: {
    flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    gap: 2, overflow: 'hidden', paddingHorizontal: 4,
  },
  cardBack: { backgroundColor: '#8b5cf6' },
  cardOpen: { backgroundColor: colors.card, borderWidth: 2, borderColor: '#ddd6fe' },
  cardMatched: { backgroundColor: '#dcfce7', borderWidth: 2, borderColor: '#86efac' },
  cardImage: { width: '100%', height: 40 },
  cardWord: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  cardLatin: { fontSize: 9, fontFamily: fonts.regular, color: colors.muted },
  hint: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', marginTop: 4 },
  doneTitle: { fontSize: 26, fontFamily: fonts.bold, color: colors.text },
  doneSub: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted },
  primaryButton: {
    marginTop: 10, backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 48,
  },
  primaryText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  secondaryButton: {
    borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 40,
  },
  secondaryText: { color: colors.muted, fontSize: 15, fontFamily: fonts.bold },
})
