import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter, Child, Word } from '@koodakbook/shared'
import { toPersianDigits, wordEmoji } from '@koodakbook/shared'
import QuizCard, { type QuizQuestion } from '@/components/QuizCard'
import MarpeleBoard, { Confetti, Dice } from '@/components/MarpeleBoard'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { characterEmoji } from '@/lib/characterEmoji'
import { LADDERS, SIZE, SNAKES, buildQuestion, preferVisual, sleep } from '@/lib/marpele'
import { colors, fonts } from '@/lib/theme'

/* مارپله برای یادگیری فارسی — one game, three ways: solo, pass-and-play with
 * other kids, or race the app's characters. Humans use Persian to climb ladders
 * / escape snakes (a QuizCard); characters ride pure luck. Every challenge the
 * active child answers posts to the same Leitner progress as lessons/review. */

const EXTRA_HUMAN_EMOJI = ['👧', '👦', '🧑']
const MAX_PLAYERS = 4

type Player = {
  key: string
  kind: 'human' | 'character'
  name: string
  emoji: string
  isActiveChild: boolean
}

export default function Marpele() {
  const insets = useSafeAreaInsets()
  const [pool, setPool] = useState<Word[] | null>(null)
  const [level, setLevel] = useState(1)
  const [childId, setChildId] = useState('')
  const [childName, setChildName] = useState('من')
  const [characters, setCharacters] = useState<AppCharacter[]>([])
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    async function load() {
      const id = await getActiveChildId()
      if (id) setChildId(id)
      const [wordsRes, childRes, charsRes] = await Promise.all([
        api.get<Word[]>('/api/words'),
        api.get<Child[]>('/api/children'),
        api.get<AppCharacter[]>('/api/characters'),
      ])
      const child = childRes.data?.find((c) => c.id === id)
      const lv = child?.level ?? 1
      setLevel(lv)
      setChildName(child?.name ?? 'من')
      setCharacters(charsRes.data ?? [])
      const all = wordsRes.data ?? []
      const filtered = all.filter((w) => w.stage <= lv + 1)
      const base = filtered.length >= 4 ? filtered : all
      setPool(preferVisual(base, (w) => !!(wordEmoji(w.english) || w.image_url)))
    }
    load()
  }, [])

  if (!pool) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!players) {
    return (
      <Setup
        insets={insets}
        childName={childName}
        characters={characters}
        onStart={setPlayers}
      />
    )
  }

  return (
    <Game
      key={run}
      players={players}
      pool={pool}
      level={level}
      childId={childId}
      insets={insets}
      onReplay={() => setRun((x) => x + 1)}
      onChangePlayers={() => setPlayers(null)}
    />
  )
}

/* ── Setup: pick who's playing ─────────────────────────────────────────── */
function Setup({ insets, childName, characters, onStart }: {
  insets: { top: number; bottom: number }
  childName: string
  characters: AppCharacter[]
  onStart: (players: Player[]) => void
}) {
  const [extraHumans, setExtraHumans] = useState(0)
  const [chosen, setChosen] = useState<string[]>([])   // character slugs

  const total = 1 + extraHumans + chosen.length
  const full = total >= MAX_PLAYERS

  function toggleChar(slug: string) {
    setChosen((c) => (c.includes(slug) ? c.filter((s) => s !== slug) : full ? c : [...c, slug]))
  }

  function start() {
    const players: Player[] = [{ key: 'me', kind: 'human', name: childName, emoji: '🧒', isActiveChild: true }]
    for (let i = 0; i < extraHumans; i++) {
      players.push({ key: `h${i}`, kind: 'human', name: `بازیکن ${toPersianDigits(i + 2)}`, emoji: EXTRA_HUMAN_EMOJI[i] ?? '🧑', isActiveChild: false })
    }
    for (const slug of chosen) {
      const ch = characters.find((c) => c.slug === slug)
      if (ch) players.push({ key: slug, kind: 'character', name: ch.name_persian, emoji: characterEmoji(ch), isActiveChild: false })
    }
    onStart(players)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.setup, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>مارپله 🎲</Text>
          <Text style={styles.subtitle}>با کی بازی می‌کنی؟</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>بازیکن‌های دیگر (خواهر و برادر)</Text>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => setExtraHumans((n) => Math.max(0, n - 1))}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{toPersianDigits(extraHumans)}</Text>
        <Pressable
          style={[styles.stepBtn, full && { opacity: 0.4 }]}
          disabled={full}
          onPress={() => setExtraHumans((n) => Math.min(MAX_PLAYERS - 1 - chosen.length, n + 1))}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>یا با دوستانت مسابقه بده</Text>
      <View style={styles.charGrid}>
        {characters.map((ch) => {
          const on = chosen.includes(ch.slug)
          return (
            <Pressable
              key={ch.slug}
              style={[styles.charChip, on && styles.charChipOn, !on && full && { opacity: 0.4 }]}
              disabled={!on && full}
              onPress={() => toggleChar(ch.slug)}
            >
              <Text style={{ fontSize: 30 }}>{characterEmoji(ch)}</Text>
              <Text style={[styles.charName, on && { color: '#fff' }]} numberOfLines={1}>{ch.name_persian}</Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.lineup}>
        {toPersianDigits(total)} بازیکن {total === 1 ? '· تنها بازی می‌کنی' : ''}
      </Text>

      <Pressable style={styles.startButton} onPress={start}>
        <Text style={styles.startText}>شروع بازی 🎲</Text>
      </Pressable>
    </ScrollView>
  )
}

/* ── A player's leaderboard card; the current player pulses ────────────── */
function PlayerCard({ player, square, active }: { player: Player; square: number; active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!active) { pulse.setValue(1); return }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [active])
  return (
    <Animated.View style={[styles.pcard, active && styles.pcardActive, { transform: [{ scale: active ? pulse : 1 }] }]}>
      <Text style={styles.pcardEmoji}>{player.emoji}</Text>
      <Text style={[styles.pcardName, active && { color: '#fff' }]} numberOfLines={1}>{player.name}</Text>
      <View style={[styles.pcardBadge, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
        <Text style={[styles.pcardBadgeText, active && { color: '#fff' }]}>{square > 0 ? toPersianDigits(square) : '۰'}</Text>
      </View>
    </Animated.View>
  )
}

/* ── Game: N players take turns ────────────────────────────────────────── */
type Challenge = { question: QuizQuestion; kind: 'ladder' | 'snake'; target: number; playerIdx: number }

function Game({ players, pool, level, childId, insets, onReplay, onChangePlayers }: {
  players: Player[]
  pool: Word[]
  level: number
  childId: string
  insets: { top: number; bottom: number }
  onReplay: () => void
  onChangePlayers: () => void
}) {
  const [positions, setPositions] = useState<number[]>(() => players.map(() => 0))
  const [current, setCurrent] = useState(0)
  const [die, setDie] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [stars, setStars] = useState(0)
  const [winner, setWinner] = useState<number | null>(null)
  const mounted = useRef(true)
  const winnerRef = useRef(false)
  useEffect(() => () => { mounted.current = false }, [])

  const cur = players[current]
  const canRoll = cur?.kind === 'human' && !animating && !challenge && winner === null

  function setPos(idx: number, val: number) {
    setPositions((p) => { const n = [...p]; n[idx] = val; return n })
  }

  async function stepTo(idx: number, from: number, to: number) {
    for (let p = from + 1; p <= to; p++) {
      if (!mounted.current) return
      setPos(idx, p)
      await sleep(150)
    }
  }

  function win(idx: number) {
    winnerRef.current = true
    setWinner(idx)
  }

  function advance(fromIdx: number) {
    if (winnerRef.current) return
    const next = (fromIdx + 1) % players.length
    setCurrent(next)
    if (players[next].kind === 'character') characterTurn(next)
  }

  async function characterTurn(idx: number) {
    setAnimating(true)
    await sleep(650)
    const r = 1 + Math.floor(Math.random() * 6)
    setDie(r)
    const from = positions[idx]
    const target = Math.min(from + r, SIZE)
    await stepTo(idx, from, target)
    if (!mounted.current) return
    if (target >= SIZE) { setAnimating(false); win(idx); return }
    if (LADDERS[target]) {
      await sleep(380); setPos(idx, LADDERS[target])
      if (LADDERS[target] >= SIZE) { setAnimating(false); win(idx); return }
    } else if (SNAKES[target]) {
      await sleep(380); setPos(idx, SNAKES[target])
    }
    if (!mounted.current) return
    setAnimating(false)
    advance(idx)
  }

  async function humanRoll() {
    if (!canRoll) return
    const idx = current
    setAnimating(true)
    const r = 1 + Math.floor(Math.random() * 6)
    setDie(r)
    const from = positions[idx]
    const target = Math.min(from + r, SIZE)
    await stepTo(idx, from, target)
    if (!mounted.current) return
    setAnimating(false)
    if (target >= SIZE) { win(idx); return }
    const ladder = LADDERS[target]
    const snake = SNAKES[target]
    if (ladder || snake) {
      const q = buildQuestion(pool, level)
      if (q) { setChallenge({ question: q, kind: ladder ? 'ladder' : 'snake', target: ladder ?? snake!, playerIdx: idx }); return }
    }
    advance(idx)
  }

  function resolve(correct: boolean) {
    const c = challenge
    if (!c) return
    // Only the logged-in child's answers feed mastery; siblings just play.
    if (players[c.playerIdx].isActiveChild && c.question.correctWord && childId) {
      void api.post('/api/progress/word', {
        child_id: childId, word_id: c.question.correctWord.id, status: 'practiced', result: correct ? 'correct' : 'incorrect',
      })
    }
    setChallenge(null)
    if (correct && players[c.playerIdx].isActiveChild) setStars((s) => s + 1)
    let next = positions[c.playerIdx]
    if (c.kind === 'ladder' && correct) next = c.target
    else if (c.kind === 'snake' && !correct) next = c.target
    setPos(c.playerIdx, next)
    if (next >= SIZE) { win(c.playerIdx); return }
    advance(c.playerIdx)
  }

  if (winner !== null) {
    const w = players[winner]
    const childWon = w.isActiveChild
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Confetti />
        <Text style={{ fontSize: 80 }}>{childWon ? '🏆' : w.emoji}</Text>
        <Text style={styles.doneTitle}>{childWon ? 'تو بردی! 🎉' : `${w.name} برد!`}</Text>
        {stars > 0 && <Text style={styles.doneSub}>{toPersianDigits(stars)} پاسخ درست دادی — عالی بود!</Text>}
        <Pressable style={styles.primaryButton} onPress={onReplay}>
          <Text style={styles.primaryText}>دوباره بازی کن 🔁</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onChangePlayers}>
          <Text style={styles.secondaryText}>تغییر بازیکن‌ها</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <Text style={styles.title}>مارپله 🎲</Text>
        {stars > 0 && <Text style={styles.stars}>⭐ {toPersianDigits(stars)}</Text>}
      </View>

      {/* Players leaderboard — avatars + square; current player glows */}
      <View style={styles.strip}>
        {players.map((p, i) => (
          <PlayerCard key={p.key} player={p} square={positions[i]} active={i === current} />
        ))}
      </View>

      <View style={styles.boardArea}>
        <MarpeleBoard positions={positions} emojis={players.map((p) => p.emoji)} />
      </View>

      <View style={styles.controls}>
        <Dice value={die} rolling={animating} />
        <Pressable style={[styles.rollButton, !canRoll && styles.rollDisabled]} disabled={!canRoll} onPress={humanRoll}>
          <Text style={styles.rollText}>
            {cur?.kind === 'human' ? 'تاس بینداز! 🎲' : `${cur?.emoji} ${cur?.name} بازی می‌کند…`}
          </Text>
        </Pressable>
      </View>

      <Modal transparent visible={challenge !== null} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.challengePrompt}>
              {challenge && `${players[challenge.playerIdx].name}: `}
              {challenge?.kind === 'ladder' ? 'جواب بده تا از نردبان بالا بروی! 🪜' : 'جواب بده تا از مار فرار کنی! 🐍'}
            </Text>
            {challenge && (
              <QuizCard
                key={challenge.target + '-' + (challenge.question.correctWord?.id ?? '')}
                question={challenge.question}
                onCorrect={() => resolve(true)}
                onIncorrect={() => resolve(false)}
                onFlashcardNext={() => resolve(true)}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  setup: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  stars: { fontSize: 16, fontFamily: fonts.bold, color: '#d97706' },
  strip: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  pcard: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card,
    borderRadius: 999, paddingVertical: 5, paddingHorizontal: 8, borderWidth: 2, borderColor: 'transparent',
  },
  pcardActive: { backgroundColor: colors.primary, borderColor: '#fde047' },
  pcardEmoji: { fontSize: 20 },
  pcardName: { fontSize: 12, fontFamily: fonts.bold, color: colors.text, maxWidth: 70 },
  pcardBadge: { backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, minWidth: 22, alignItems: 'center' },
  pcardBadgeText: { fontSize: 12, fontFamily: fonts.bold, color: colors.text },
  sectionLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.text, marginTop: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18, alignSelf: 'flex-start', backgroundColor: colors.card, borderRadius: 16, padding: 10 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 22, fontFamily: fonts.bold, color: colors.primary },
  stepValue: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, minWidth: 24, textAlign: 'center' },
  charGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  charChip: {
    width: '30%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 16, padding: 12,
    alignItems: 'center', gap: 4, borderWidth: 2, borderColor: 'transparent',
  },
  charChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  charName: { fontSize: 12, fontFamily: fonts.medium, color: colors.text },
  lineup: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', marginTop: 4 },
  startButton: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  startText: { color: '#fff', fontSize: 18, fontFamily: fonts.bold },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rollButton: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 20, paddingVertical: 18, alignItems: 'center',
    borderBottomWidth: 4, borderBottomColor: '#5b21b6',
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  rollDisabled: { backgroundColor: '#cbd5e1', borderBottomColor: '#94a3b8', shadowOpacity: 0 },
  rollText: { color: '#fff', fontSize: 18, fontFamily: fonts.bold },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.bg, borderRadius: 24, padding: 20, width: '100%', maxWidth: 380, gap: 12 },
  challengePrompt: { fontSize: 15, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  doneTitle: { fontSize: 26, fontFamily: fonts.bold, color: colors.text },
  doneSub: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  primaryButton: { marginTop: 10, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  primaryText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  secondaryButton: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 40 },
  secondaryText: { color: colors.muted, fontSize: 15, fontFamily: fonts.bold },
})
