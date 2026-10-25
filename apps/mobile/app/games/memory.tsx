import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter, CharacterLine, Child, Word } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import FriendAvatar from '@/components/FriendAvatar'
import { mediaUrl } from '@/lib/media'
import { playClip } from '@/lib/sound'
import { playSuccess, playTap } from '@/lib/uiSound'
import { shuffle } from '@/lib/math'
import CelebrationOverlay from '@/components/CelebrationOverlay'
import ScreenBackground from '@/components/ScreenBackground'
import LoadState from '@/components/LoadState'
import { CharacterArt, ClayButton, HostAvatar } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { RESULT_ART, ResultCard, StatChip } from '@/components/GameKit'
import { clay, colors, fonts, radii, ramps, spacing, textSize, ui } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import BottomNav from '@/components/BottomNav'

/* بازی حافظه — ported from web /child/games/memory. Data-driven off the word
 * catalog; each flip speaks the word so pre-readers play by sound. Optional
 * ?host=<slug> lets a friend present the game (game_open / praise lines). */

const PAIRS = 6
const DONE_TITLE = 'همه را پیدا کردی!'
// Card text is capped at 1.3x the system size: the card's height comes from
// its width (aspectRatio, so the two stacked faces can flip), and at the
// largest sizes the word and its picture no longer fit a 320pt phone's card.
const CARD_TEXT_SCALE = 1.3

// 3D flip (rotateY), replacing the old instant swap between back/front --
// mirrors web's card-flip transition (2026-09-20 audit, UI High #7). Two
// absolutely-stacked faces rotate in lockstep, each hidden past 90deg via
// backfaceVisibility so only one is ever legible at a time.
// 2026-09-25 convergence pass: the faces take clay colours (games ramp; the
// lessons ramp's green once matched) and a thicker bottom rim for the clay
// edge, drawn as plain View borders on the two existing faces -- no extra
// layers (gradient/SVG) inside a face, so the backface hiding and the
// absolute stacking are exactly as before. A matched card also shows a ✅, so
// "matched" isn't a colour change alone.
function MemoryCard({ card, position, isOpen, isMatched, onPress }: {
  card: Card; position: number; isOpen: boolean; isMatched: boolean; onPress: () => void
}) {
  const flip = useRef(new Animated.Value(isOpen ? 1 : 0)).current
  useEffect(() => {
    const turn = Animated.timing(flip, {
      toValue: isOpen ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    })
    turn.start()
    return () => turn.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  return (
    <Pressable
      accessibilityRole="button"
      // Both faces are always rendered (the flip only hides one visually),
      // so without this a screen reader read out the hidden word.
      // Numbered, as on web, so a reader can tell the cards apart and find
      // the one it heard before.
      accessibilityLabel={isOpen || isMatched
        ? `${card.persian}، کارت ${toPersianDigits(position)}${isMatched ? '، جفت شد' : ''}`
        : `کارت بسته ${toPersianDigits(position)}`}
      // An open or matched card ignores taps (flip() below).
      accessibilityState={{ disabled: isOpen || isMatched }}
      style={styles.cardSlot}
      onPress={onPress}
    >
      <Animated.View
        style={[styles.cardFace, styles.cardBack, StyleSheet.absoluteFill, { transform: [{ perspective: 800 }, { rotateY: backRotate }] }]}
      >
        {/* A drawn star in a white ring (was a 🌟 glyph): the same line
            icon set as the rest of the app, and the same back on every card. */}
        <View style={styles.cardBackInset}>
          <View style={styles.cardBackRing}>
            <Icon name="star" color={colors.card} size={30} filled />
          </View>
        </View>
      </Animated.View>
      <Animated.View
        style={[
          styles.cardFace, isMatched ? styles.cardMatched : styles.cardOpen, StyleSheet.absoluteFill,
          { transform: [{ perspective: 800 }, { rotateY: frontRotate }] },
        ]}
      >
        {card.image && <Image source={{ uri: card.image }} style={styles.cardImage} contentFit="cover" />}
        <Text style={[styles.cardWord, isMatched && styles.cardWordMatched, card.image && styles.cardWordSmall]} numberOfLines={1} maxFontSizeMultiplier={CARD_TEXT_SCALE}>{card.persian}</Text>
        <Text style={styles.cardLatin} numberOfLines={1} maxFontSizeMultiplier={CARD_TEXT_SCALE}>{card.english}</Text>
        {isMatched ? (
          <View style={styles.cardCheck}>
            <Icon name="check" color={ramps.lessons.ink} size={14} strokeWidth={3} />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  )
}

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
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // The host (and its greeting) is its own effect so a retry of the word
  // list below doesn't replay the greeting. Both drop their results, and the
  // greeting's delayed clip, if the screen closes first.
  useEffect(() => {
    if (!hostSlug) return
    let cancelled = false
    let greet: ReturnType<typeof setTimeout> | undefined
    api.get<AppCharacter[]>('/api/characters').then((r) => {
      if (cancelled) return
      const h = r.data?.find((c) => c.slug === hostSlug) ?? null
      setHost(h)
      const open = pickLine(h, 'game_open') ?? pickLine(h, 'greeting')
      if (open?.audio_url) greet = setTimeout(() => playClip(open.audio_url), 600)
    })
    return () => { cancelled = true; if (greet) clearTimeout(greet) }
  }, [hostSlug])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const childId = await getActiveChildId()
      const [wordsRes, childRes] = await Promise.all([
        api.get<Word[]>('/api/words'),
        api.get<Child[]>('/api/children'),
      ])
      if (cancelled) return
      // A failed word list used to start a board with no cards that could
      // never finish; it now gets LoadState's message and retry.
      if (!wordsRes.data && wordsRes.error) { setError(wordsRes.error); return }
      // An empty list is the same dead end (a board that can never finish).
      if (!wordsRes.data?.length) { setError('هنوز کلمه‌ای برای این بازی نیست'); return }
      const child = childRes.data?.find((c) => c.id === childId)
      const level = child?.level ?? 1
      // Short, level-appropriate words read best on small cards.
      const pool = (wordsRes.data ?? []).filter((w) => w.stage <= level && w.persian.length <= 6)
      setWords(pool.length >= PAIRS ? pool : (wordsRes.data ?? []))
    }
    load().catch(() => { if (!cancelled) setError('اتصال برقرار نشد. دوباره تلاش کن') })
    return () => { cancelled = true }
  }, [attempt])

  if (!words) {
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        <LoadState
          error={error}
          onRetry={() => { setError(null); setAttempt((a) => a + 1) }}
          onBack={() => goBack('/games')}
        />
      </ScreenBackground>
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
  // Fewer than PAIRS words in the catalogue deals fewer pairs; finishing
  // used to require PAIRS matches regardless, so such a board never ended.
  const pairCount = cards.length / 2
  const done = pairCount > 0 && matched.size === pairCount
  // What's face up right now, updated at once: two taps in one frame both
  // read the same stale `open` and the first card was dropped.
  const openRef = useRef<string[]>([])

  // Pending flip-back / match timers. Leaving mid-turn used to fire them on
  // an unmounted board (and a replay's new board never saw them, since the
  // old board is keyed away), so they are cleared on unmount.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = [] }, [])
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }

  useEffect(() => {
    if (!done) return
    AccessibilityInfo.announceForAccessibility(`${DONE_TITLE} با ${toPersianDigits(moves)} حرکت`)
    const praise = pickLine(host, 'praise')
    if (praise?.audio_url) later(() => playClip(praise.audio_url), 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function showOpen(next: string[]) { openRef.current = next; setOpen(next) }

  function flip(card: Card) {
    const cur = openRef.current
    if (cur.length === 2 || cur.includes(card.key) || matched.has(card.wordId)) return
    playClip(card.audio)
    const next = [...cur, card.key]
    showOpen(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next.map((k) => cards.find((c) => c.key === k)!)
      if (a.wordId === b.wordId) {
        playSuccess()
        // The flipped card's word is its audio; a match was only a colour and
        // a ✅ until now, so a screen reader hears it once, here. Not for the
        // last pair: the finish is announced 450ms later and would cut it off.
        if (matched.size + 1 < pairCount) AccessibilityInfo.announceForAccessibility(`${a.persian}، جفت شد`)
        later(() => { setMatched((s) => new Set(s).add(a.wordId)); showOpen([]) }, 450)
      } else {
        playTap()
        later(() => showOpen([]), 950)
      }
    }
  }

  if (done) {
    return (
      <ScreenBackground variant="warm" style={[styles.center, styles.done]}>
        <CelebrationOverlay />
        {/* The shared finish card (GameKit): the friend who hosted the game,
            else تندپا (games' host on Home), over the room's sunburst. */}
        <ResultCard
          ramp={ramps.games}
          art={host ? <FriendAvatar character={host} size={RESULT_ART} emotion="proud" /> : <CharacterArt character="tondpa" emotion="proud" size={RESULT_ART} />}
          title={DONE_TITLE}
          sub={`${toPersianDigits(pairCount)} جفت با ${toPersianDigits(moves)} حرکت — عالی بود!`}
        >
          <ClayButton ramp={ramps.games} label="دوباره بازی کن" emoji="🔁" onPress={onReplay} />
          <ClayButton ramp={ramps.games} tone="soft" label="برگشت" emoji="🏠" onPress={() => goBack('/games')} />
        </ResultCard>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 92 }]}
    >
      <ScreenHeader
        style={{ paddingHorizontal: 0 }}
        title="بازی حافظه"
        titleEmoji="🃏"
        subtitle="جفت هر کلمه را پیدا کن"
        fallback="/games"
        right={host ? <FriendAvatar character={host} size={44} /> : <HostAvatar ramp={ramps.games} size={44} character="tondpa" />}
      />

      {/* Stat chips (GameKit), each one stop that says itself in words. */}
      <View style={styles.statusRow}>
        <StatChip
          ramp={ramps.games}
          icon="check"
          value={`${toPersianDigits(matched.size)} از ${toPersianDigits(pairCount)}`}
          accessibilityLabel={`جفت‌ها: ${toPersianDigits(matched.size)} از ${toPersianDigits(pairCount)}`}
        />
        <StatChip
          ramp={ramps.games}
          icon="refresh"
          value={toPersianDigits(moves)}
          accessibilityLabel={`حرکت: ${toPersianDigits(moves)}`}
        />
      </View>

      <View style={styles.grid}>
        {cards.map((card, i) => {
          const isOpen = open.includes(card.key) || matched.has(card.wordId)
          const isMatched = matched.has(card.wordId)
          return <MemoryCard key={card.key} card={card} position={i + 1} isOpen={isOpen} isMatched={isMatched} onPress={() => flip(card)} />
        })}
      </View>

      <Text style={styles.hint}>روی کارت‌ها بزن، کلمه را بشنو و جفتش را پیدا کن</Text>
    </ScrollView>
    <BottomNav />
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm + spacing.xs },
  // Wraps at large text sizes instead of running the two counts together.
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardSlot: { width: '31.5%', flexGrow: 1, aspectRatio: 0.78, position: 'relative' },
  cardFace: {
    flex: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center',
    gap: 2, overflow: 'hidden', paddingHorizontal: 4, backfaceVisibility: 'hidden',
  },
  // Clay: face colour, a ramp rim, and a thicker bottom rim as the edge.
  cardBack: {
    backgroundColor: ramps.games.bright, borderWidth: 2, borderBottomWidth: clay.edge, borderColor: ramps.games.deep,
  },
  cardOpen: {
    backgroundColor: ramps.games.soft, borderWidth: 2, borderBottomWidth: clay.edge, borderColor: ramps.games.bright,
  },
  cardMatched: {
    backgroundColor: ramps.lessons.soft, borderWidth: 2, borderBottomWidth: clay.edge, borderColor: ramps.lessons.bright,
  },
  cardImage: { width: '100%', height: 40 },
  cardBackInset: {
    position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, margin: spacing.xs + 2, borderRadius: radii.sm,
    borderWidth: 1.5, borderColor: ui.onDeepMuted, alignItems: 'center', justifyContent: 'center',
  },
  cardBackRing: {
    width: 52, height: 52, borderRadius: radii.pill, backgroundColor: ramps.games.deep,
    borderWidth: 3, borderColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  cardWord: { fontSize: textSize.body, fontFamily: fonts.display, color: ramps.games.ink },
  cardWordSmall: { fontSize: textSize.small },
  cardWordMatched: { color: ramps.lessons.ink },
  // micro (11), was 9: the smallest step on the type ladder. ui.textMuted,
  // not colors.muted: 6.2:1 on the games soft face (muted was 4.9:1).
  cardLatin: { fontSize: textSize.micro, fontFamily: fonts.regular, color: ui.textMuted },
  // In the corner, out of the column: in the flow it pushed a matched card's
  // picture + word + latin past the card's height at 320pt / large text.
  cardCheck: {
    position: 'absolute', top: spacing.xs, end: spacing.xs, width: 22, height: 22, borderRadius: radii.pill,
    backgroundColor: ramps.lessons.bright, alignItems: 'center', justifyContent: 'center',
  },
  hint: { fontSize: textSize.micro, fontFamily: fonts.regular, color: colors.text, textAlign: 'center', marginTop: spacing.xs },
  done: { gap: spacing.sm + spacing.xs, padding: spacing.lg },
})
