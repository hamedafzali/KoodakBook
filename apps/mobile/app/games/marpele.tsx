import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter, Child, Word } from '@koodakbook/shared'
import { LADDERS, SIZE, SNAKES, buildQuestion, preferVisual, sleep, toPersianDigits, wordEmoji } from '@koodakbook/shared'
import QuizCard, { type QuizQuestion } from '@/components/QuizCard'
import MarpeleBoard, { Dice } from '@/components/MarpeleBoard'
import CelebrationOverlay from '@/components/CelebrationOverlay'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { characterEmoji } from '@/lib/characterEmoji'
import { playSuccess, playTap } from '@/lib/uiSound'
import ScreenBackground from '@/components/ScreenBackground'
import LoadState from '@/components/LoadState'
import { CharacterArt, ClayButton, ClayCard, ClaySurface, HostAvatar, SectionHeading } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { RESULT_ART, ResultCard, StatChip, boardFirstFrame } from '@/components/GameKit'
import FriendAvatar from '@/components/FriendAvatar'
import { hasCharacterArt } from '@/lib/characterSvg'
import { clay, colors, fonts, radii, ramps, scenery, spacing, textSize, textStart, ui } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import BottomNav from '@/components/BottomNav'

/* مارپله برای یادگیری فارسی — one game, three ways: solo, pass-and-play with
 * other kids, or race the app's characters. Humans use Persian to climb ladders
 * / escape snakes (a QuizCard); characters ride pure luck. Every challenge the
 * active child answers posts to the same Leitner progress as lessons/review. */

const EXTRA_HUMAN_EMOJI = ['👧', '👦', '🧑']
const MAX_PLAYERS = 4
// What the game screen stacks around the board (header, player strip, dice
// row, their gaps, the padding) -- only for the first frame's size estimate.
const MARPELE_CHROME = 236

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
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const id = await getActiveChildId()
      if (cancelled) return
      if (id) setChildId(id)
      const [wordsRes, childRes, charsRes] = await Promise.all([
        api.get<Word[]>('/api/words'),
        api.get<Child[]>('/api/children'),
        api.get<AppCharacter[]>('/api/characters'),
      ])
      if (cancelled) return
      // A failed load used to start anyway: no word list meant no ladder or
      // snake question ever appeared, and no characters meant an empty
      // «race your friends» grid, with nothing saying why. Now LoadState.
      const failed = wordsRes.error ?? childRes.error ?? charsRes.error
      if (failed) { setError(failed); return }
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
    load().catch(() => { if (!cancelled) setError('اتصال برقرار نشد. دوباره تلاش کن') })
    return () => { cancelled = true }
  }, [attempt])

  if (!pool) {
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

  const addHuman = () => setExtraHumans((n) => Math.min(MAX_PLAYERS - 1 - chosen.length, n + 1))
  const removeHuman = () => setExtraHumans((n) => Math.max(0, n - 1))

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
    <ScreenBackground variant="warm">
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.setup, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 92 }]}>
      <ScreenHeader style={{ paddingHorizontal: 0 }} title="مارپله" titleEmoji="🎲" subtitle="با کی بازی می‌کنی؟" fallback="/games" right={<HostAvatar ramp={ramps.games} size={44} character="tondpa" />} />

      {/* 2026-09-28: the siblings stepper is a soft clay card of its own
          (icon, what it is, the stepper), not a caption over a bare pill. It
          wraps at 320pt / large text: the stepper drops under the words. */}
      <ClaySurface ramp={ramps.games} tone="soft" radius={radii.lg} faceStyle={styles.siblingsFace}>
        <View style={styles.siblingsIcon}>
          <Icon name="users" color={ramps.games.ink} size={26} />
        </View>
        {/* Said by the stepper itself (its label), so not a second time. */}
        <View style={styles.siblingsText} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.siblingsTitle}>بازیکن‌های دیگر</Text>
          <Text style={styles.siblingsSub}>خواهر و برادر، کنار هم با یک گوشی</Text>
        </View>
      {/* In a row: a column's flex-start cross axis doesn't follow forced RTL
          (Clay.tsx), so alignSelf alone put the stepper at the physical left. */}
      {/* One adjustable control to a screen reader (swipe up/down), with its
          value spoken as words: the two keys and a bare digit used to be
          three separate stops with no link between them. The keys stay for
          touch. */}
      <View
        style={styles.stepperRow}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="بازیکن‌های دیگر، خواهر و برادر"
        accessibilityValue={{ text: `${toPersianDigits(extraHumans)} نفر` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') addHuman()
          else if (e.nativeEvent.actionName === 'decrement') removeHuman()
        }}
      >
        <View style={styles.stepper}>
          <StepButton label="یک بازیکن کمتر" glyph="minus" disabled={extraHumans === 0} onPress={removeHuman} />
          <View style={styles.stepValueDisc}>
            <Text style={styles.stepValue}>{toPersianDigits(extraHumans)}</Text>
          </View>
          <StepButton label="یک بازیکن بیشتر" glyph="plus" disabled={full} onPress={addHuman} />
        </View>
      </View>
      </ClaySurface>

      <SectionHeading eyebrow={`تا ${toPersianDigits(MAX_PLAYERS)} بازیکن با هم`} title="یا با دوستانت مسابقه بده" />
      <View style={styles.charGrid}>
        {characters.map((ch) => {
          const on = chosen.includes(ch.slug)
          return (
            // Chosen = bright clay, the shared selected ring AND a ✓ before
            // the name, not colour alone; selected is spoken either way. The
            // cast's own art (FriendAvatar), not an emoji guess from its type.
            <ClayCard
              key={ch.slug}
              ramp={ramps.games}
              tone={on ? 'bright' : 'soft'}
              selected={on}
              disabled={!on && full}
              accessibilityLabel={ch.name_persian}
              onPress={() => toggleChar(ch.slug)}
              radius={radii.md}
              edge={clay.edgeSm}
              style={styles.charChip}
              surfaceStyle={styles.fill}
              faceStyle={styles.charFace}
            >
              <FriendAvatar character={ch} size={48} ramp={ramps.games} />
              <Text style={styles.charName} numberOfLines={2}>{on ? `✓ ${ch.name_persian}` : ch.name_persian}</Text>
            </ClayCard>
          )
        })}
      </View>

      <View style={styles.lineup}>
        <StatChip
          ramp={ramps.games}
          icon="users"
          value={`${toPersianDigits(total)} بازیکن${total === 1 ? ' · تنها بازی می‌کنی' : ''}`}
          accessibilityLabel={`${toPersianDigits(total)} بازیکن${total === 1 ? '، تنها بازی می‌کنی' : ''}`}
        />
      </View>

      <ClayButton ramp={ramps.games} label="شروع بازی" emoji="🎲" onPress={start} style={styles.startButton} />
    </ScrollView>
    <BottomNav />
    </ScreenBackground>
  )
}

/** A stepper key: small bright clay, ink glyph, a Persian name for readers. */
function StepButton({ label, glyph, disabled, onPress }: { label: string; glyph: 'plus' | 'minus'; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={disabled && styles.dimmed}
      // Inside the adjustable stepper: that one control is what a screen
      // reader reaches, so the keys stay out of its way.
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      {({ pressed }) => (
        <ClaySurface ramp={ramps.games} tone="bright" pressed={pressed && !disabled} radius={radii.sm} edge={clay.edgeSm} faceStyle={styles.stepBtn}>
          {/* Drawn icons, not the − / + characters. */}
          <Icon name={glyph} color={ramps.games.ink} size={24} strokeWidth={3} />
        </ClaySurface>
      )}
    </Pressable>
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
    <Animated.View
      accessible
      accessibilityLabel={`${player.name}، خانهٔ ${toPersianDigits(square)}${active ? '، نوبت اوست' : ''}`}
      style={[styles.pcard, active && styles.pcardActive, { transform: [{ scale: active ? pulse : 1 }] }]}
    >
      <Text style={styles.pcardEmoji}>{player.emoji}</Text>
      <Text style={[styles.pcardName, active && { color: ramps.games.ink }]} numberOfLines={1}>{player.name}</Text>
      <View style={[styles.pcardBadge, active && { backgroundColor: ramps.games.soft }]}>
        <Text style={[styles.pcardBadgeText, active && { color: ramps.games.ink }]}>{square > 0 ? toPersianDigits(square) : '۰'}</Text>
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

  useEffect(() => {
    if (winner === null) return
    // The win sound is CelebrationOverlay's (it mounts with the result).
    // The result replaces the board with no focus change: said once, here.
    const w = players[winner]
    AccessibilityInfo.announceForAccessibility(w.isActiveChild ? 'تو بردی!' : `${w.name} برد!`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner])
  // Measured by onLayout, but drawn from the first frame at a size worked
  // out from the window (boardFirstFrame): the board used to be blank until
  // the measurement came back. The measurement then corrects it, usually to
  // the same size (a portrait phone's board is width-bound).
  const windowSize = useWindowDimensions()
  const [boardArea, setBoardArea] = useState<{ w: number; h: number } | null>(null)
  const area = boardArea ?? boardFirstFrame(windowSize, insets, MARPELE_CHROME)
  const mounted = useRef(true)
  const winnerRef = useRef(false)
  // Set true in the effect too, so a dev StrictMode effect replay (cleanup,
  // then setup) doesn't leave it false and freeze every move.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // Two taps land before the re-render that disables the button / closes the
  // challenge, so each would roll or resolve again: refs, not state.
  const rollingRef = useRef(false)
  const resolvedRef = useRef<Challenge | null>(null)

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

  // Screen-reader narration, one announcement per move: what the roll did
  // (`lead`) and whose turn it is when that changes hands to a person (pass-
  // and-play, or back to the child after the characters). The roll used to be
  // announced the moment it was thrown, so a turn line a few hundred ms later
  // would cut it off (iOS drops an announcement a newer one interrupts).
  const humans = players.filter((p) => p.kind === 'human').length
  function narrate(lead: string | null, from: number, next: number) {
    const handsOver = players[next].kind === 'human' && next !== from && (humans > 1 || players[from].kind === 'character')
    const turn = handsOver ? (players[next].isActiveChild ? 'نوبت توست' : `نوبت ${players[next].name}`) : null
    const text = [lead, turn].filter(Boolean).join('. ')
    if (text) AccessibilityInfo.announceForAccessibility(text)
  }

  function advance(fromIdx: number, lead: string | null = null) {
    if (winnerRef.current) return
    const next = (fromIdx + 1) % players.length
    narrate(lead, fromIdx, next)
    setCurrent(next)
    if (players[next].kind === 'character') characterTurn(next)
  }

  async function characterTurn(idx: number) {
    setAnimating(true)
    await sleep(650)
    if (!mounted.current) return
    const r = 1 + Math.floor(Math.random() * 6)
    setDie(r)
    const from = positions[idx]
    const target = Math.min(from + r, SIZE)
    await stepTo(idx, from, target)
    if (!mounted.current) return
    if (target >= SIZE) { setAnimating(false); win(idx); return }
    let lead = `${players[idx].name}: ${toPersianDigits(r)}`
    if (LADDERS[target]) {
      await sleep(380); if (!mounted.current) return
      setPos(idx, LADDERS[target])
      if (LADDERS[target] >= SIZE) { setAnimating(false); win(idx); return }
      lead += '، از نردبان بالا رفت'
    } else if (SNAKES[target]) {
      await sleep(380); if (!mounted.current) return
      setPos(idx, SNAKES[target])
      lead += '، مار پایینش آورد'
    }
    if (!mounted.current) return
    setAnimating(false)
    advance(idx, lead)
  }

  async function humanRoll() {
    if (!canRoll || rollingRef.current) return
    rollingRef.current = true
    playTap()
    const idx = current
    setAnimating(true)
    const r = 1 + Math.floor(Math.random() * 6)
    setDie(r)
    const from = positions[idx]
    const target = Math.min(from + r, SIZE)
    await stepTo(idx, from, target)
    rollingRef.current = false
    if (!mounted.current) return
    setAnimating(false)
    if (target >= SIZE) { win(idx); return }
    const lead = `${players[idx].name}: ${toPersianDigits(r)}`
    const ladder = LADDERS[target]
    const snake = SNAKES[target]
    if (ladder || snake) {
      const q = buildQuestion(pool, level)
      // The challenge modal takes focus and reads its own prompt.
      if (q) { setChallenge({ question: q, kind: ladder ? 'ladder' : 'snake', target: ladder ?? snake!, playerIdx: idx }); return }
    }
    advance(idx, lead)
  }

  function resolve(correct: boolean) {
    const c = challenge
    // Once per challenge: a double tap in QuizCard answers twice.
    if (!c || resolvedRef.current === c) return
    resolvedRef.current = c
    // Only the logged-in child's answers feed mastery; siblings just play.
    if (players[c.playerIdx].isActiveChild && c.question.correctWord && childId) {
      void api.post('/api/progress/word', {
        child_id: childId, word_id: c.question.correctWord.id, status: 'practiced', result: correct ? 'correct' : 'incorrect',
      })
    }
    // QuizCard's answer delay isn't cleared when the screen closes: the answer
    // above still counts, but no sound or move on a screen that's gone.
    if (!mounted.current) return
    setChallenge(null)
    if (correct) playSuccess(); else playTap()
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
      <ScreenBackground variant="warm" style={[styles.center, styles.done]}>
        {/* CelebrationOverlay, not bare Confetti: it hides the ~22 falling
            emoji from screen readers (they could land on each one) and plays
            the completion sound once, as every other result screen does. */}
        <CelebrationOverlay />
        {/* The shared finish card (GameKit). A cast character who won is
            drawn as itself; otherwise تندپا, games' host, cheers (proud for
            the child, happy for a sibling). */}
        <ResultCard
          ramp={ramps.games}
          art={w.kind === 'character' && hasCharacterArt(w.key)
            ? <CharacterArt character={w.key} emotion="proud" size={RESULT_ART} />
            : <CharacterArt character="tondpa" emotion={childWon ? 'proud' : 'happy'} size={RESULT_ART} />}
          title={childWon ? 'تو بردی!' : `${w.name} برد!`}
          sub={stars > 0 ? `${toPersianDigits(stars)} پاسخ درست دادی — عالی بود!` : undefined}
        >
          <ClayButton ramp={ramps.games} label="دوباره بازی کن" emoji="🔁" onPress={onReplay} />
          <ClayButton ramp={ramps.games} tone="soft" label="تغییر بازیکن‌ها" onPress={onChangePlayers} />
        </ResultCard>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm" style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <ScreenHeader
        style={styles.gameHeader}
        title="مارپله"
        titleEmoji="🎲"
        fallback="/games"
        right={<StatChip ramp={ramps.games} icon="rewardStar" value={toPersianDigits(stars)} accessibilityLabel={`${toPersianDigits(stars)} ستاره`} hidden={stars === 0} />}
      />

      {/* Players leaderboard — avatars + square; current player glows */}
      <View style={styles.strip}>
        {players.map((p, i) => (
          <PlayerCard key={p.key} player={p} square={positions[i]} active={i === current} />
        ))}
      </View>

      <View
        style={styles.boardArea}
        onLayout={(e) => setBoardArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {area.h > 0 && (
          <MarpeleBoard
            positions={positions}
            emojis={players.map((p) => p.emoji)}
            maxWidth={area.w}
            maxHeight={area.h}
            accessibilityLabel={`صفحهٔ مارپله: ${players.map((p, i) => `${p.name} در خانهٔ ${toPersianDigits(positions[i])}`).join('، ')}`}
          />
        )}
      </View>

      <View style={styles.controls}>
        <Dice value={die} rolling={animating} />
        {/* Waiting is the quiet soft clay, not a faded button: while a
            character plays, the label says who, so it stays full contrast. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cur?.kind === 'human' ? `نوبت ${cur.name}: تاس بینداز` : `${cur?.name ?? ''} بازی می‌کند`}
          accessibilityState={{ disabled: !canRoll }}
          style={styles.rollSlot}
          disabled={!canRoll}
          onPress={humanRoll}
        >
          {({ pressed }) => (
            <ClaySurface ramp={ramps.games} tone={canRoll ? 'bright' : 'soft'} pressed={pressed && canRoll} radius={radii.lg} faceStyle={styles.rollFace}>
              <Text style={styles.rollText} numberOfLines={2}>
                {cur?.kind === 'human' ? 'تاس بینداز! 🎲' : `${cur?.emoji} ${cur?.name} بازی می‌کند…`}
              </Text>
            </ClaySurface>
          )}
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
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, gap: spacing.sm + spacing.xs },
  center: { alignItems: 'center', justifyContent: 'center' },
  setup: { paddingHorizontal: spacing.md, gap: spacing.sm + spacing.xs },
  gameHeader: { paddingHorizontal: 0, paddingBottom: 0 },
  fill: { flex: 1 },
  dimmed: { opacity: ui.disabledOpacity },
  strip: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', flexWrap: 'wrap' },
  pcard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, backgroundColor: colors.card,
    borderRadius: radii.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 2, borderColor: ramps.games.soft,
    minHeight: ui.hit,
  },
  pcardActive: { backgroundColor: ramps.games.bright, borderColor: ramps.games.deep },
  pcardEmoji: { fontSize: textSize.cardTitle },
  // maxWidth 88 (was 70): room for a short name at the caption step before
  // «…»; the strip wraps, so four players still fit a 320pt phone.
  pcardName: { fontSize: textSize.caption, fontFamily: fonts.bold, color: colors.text, maxWidth: 88 },
  pcardBadge: { backgroundColor: ramps.games.soft, borderRadius: radii.pill, paddingHorizontal: spacing.xs + 3, paddingVertical: 1, minWidth: 22, alignItems: 'center' },
  pcardBadgeText: { fontSize: textSize.caption, fontFamily: fonts.bold, color: colors.text },
  siblingsFace: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
  },
  siblingsIcon: {
    width: 48, height: 48, borderRadius: radii.pill, backgroundColor: colors.card,
    borderWidth: 3, borderColor: ramps.games.bright, alignItems: 'center', justifyContent: 'center',
  },
  siblingsText: { flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 2 },
  siblingsTitle: { fontSize: textSize.body, fontFamily: fonts.display, color: ramps.games.ink, textAlign: textStart },
  siblingsSub: { fontSize: textSize.caption, fontFamily: fonts.medium, color: colors.text, textAlign: textStart },
  stepperRow: { flexDirection: 'row' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: ui.hit, height: ui.hit, alignItems: 'center', justifyContent: 'center' },
  stepValueDisc: {
    minWidth: ui.hit, height: ui.hit, borderRadius: radii.pill, backgroundColor: colors.card,
    borderWidth: 2, borderColor: ramps.games.bright, alignItems: 'center', justifyContent: 'center',
  },
  stepValue: { fontSize: textSize.cardTitle, fontFamily: fonts.bold, color: ramps.games.ink, textAlign: 'center' },
  charGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  charChip: { width: '30%', flexGrow: 1 },
  charFace: { flex: 1, padding: spacing.sm + spacing.xs, alignItems: 'center', gap: spacing.xs },
  charName: { fontSize: textSize.caption, fontFamily: fonts.bold, color: ramps.games.ink, textAlign: 'center' },
  lineup: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xs },
  startButton: { marginTop: spacing.xs },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  rollSlot: { flex: 1 },
  rollFace: { minHeight: 60, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  rollText: { color: ramps.games.ink, fontSize: textSize.body, fontFamily: fonts.display, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: ui.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard: { backgroundColor: colors.bg, borderRadius: radii.lg, padding: spacing.md + spacing.xs, width: '100%', maxWidth: 380, gap: spacing.sm + spacing.xs },
  challengePrompt: { fontSize: textSize.small, fontFamily: fonts.bold, color: scenery.ink, textAlign: 'center' },
  done: { gap: spacing.sm + spacing.xs, padding: spacing.lg },
})
