import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, Word } from '@koodakbook/shared'
import { toPersianDigits, wordEmoji } from '@koodakbook/shared'
import QuizCard, { type QuizMode, type QuizQuestion } from '@/components/QuizCard'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'

/* مارپله برای یادگیری فارسی (V1, solo) — roll the die and move, but Persian
 * knowledge drives the board: land on a ladder foot and answer right to climb;
 * land on a snake head and answer right to escape the bite. Every challenge is
 * a QuizCard and posts to the same Leitner progress as lessons/review. */

const SIZE = 30
const COLS = 5
const ROWS = SIZE / COLS

// foot → top (climb up on a correct answer)
const LADDERS: Record<number, number> = { 3: 11, 6: 14, 9: 21, 16: 26 }
// head → tail (slide down on a wrong answer)
const SNAKES: Record<number, number> = { 13: 4, 19: 8, 24: 15, 28: 18 }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

function buildQuestion(pool: Word[], level: number): QuizQuestion | null {
  if (pool.length < 4) return null
  const correct = pool[Math.floor(Math.random() * pool.length)]
  const distractors = pickRandom(pool.filter((w) => w.id !== correct.id), 3)
  const modes: QuizMode[] = level <= 1 ? ['match_image', 'listen_tap'] : ['match_image', 'listen_tap', 'name_it']
  return { mode: modes[Math.floor(Math.random() * modes.length)], correctWord: correct, distractorWords: distractors }
}

// Board rows for rendering: square 1 at bottom-left, snaking upward (boustrophedon).
function boardRows(): number[][] {
  const rows: number[][] = []
  for (let r = ROWS - 1; r >= 0; r--) {
    const nums = Array.from({ length: COLS }, (_, i) => r * COLS + i + 1)
    rows.push(r % 2 === 1 ? nums.reverse() : nums)
  }
  return rows
}

type Challenge = { question: QuizQuestion; kind: 'ladder' | 'snake'; target: number }

export default function Marpele() {
  const insets = useSafeAreaInsets()
  const [pool, setPool] = useState<Word[] | null>(null)
  const [level, setLevel] = useState(1)
  const [childId, setChildId] = useState('')
  const [run, setRun] = useState(0)

  useEffect(() => {
    async function load() {
      const id = await getActiveChildId()
      if (id) setChildId(id)
      const [wordsRes, childRes] = await Promise.all([
        api.get<Word[]>('/api/words'),
        api.get<Child[]>('/api/children'),
      ])
      const child = childRes.data?.find((c) => c.id === id)
      const lv = child?.level ?? 1
      setLevel(lv)
      const all = wordsRes.data ?? []
      const filtered = all.filter((w) => w.stage <= lv + 1)
      // Prefer words with a picture so match/name challenges show a real visual,
      // not a «؟» prompt.
      const withVisual = filtered.filter((w) => wordEmoji(w.english) || w.image_url)
      setPool(withVisual.length >= 4 ? withVisual : filtered.length >= 4 ? filtered : all)
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
  return <Game key={run} pool={pool} level={level} childId={childId} insets={insets} onReplay={() => setRun((x) => x + 1)} />
}

function Game({ pool, level, childId, insets, onReplay }: {
  pool: Word[]
  level: number
  childId: string
  insets: { top: number; bottom: number }
  onReplay: () => void
}) {
  const [pos, setPos] = useState(0)          // 0 = start (off board); 1..SIZE
  const [die, setDie] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [stars, setStars] = useState(0)
  const [won, setWon] = useState(false)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const rows = useMemo(boardRows, [])
  const busy = rolling || challenge !== null || won

  function report(word: Word, correct: boolean) {
    if (!childId) return
    void api.post('/api/progress/word', {
      child_id: childId, word_id: word.id, status: 'practiced', result: correct ? 'correct' : 'incorrect',
    })
  }

  async function roll() {
    if (busy) return
    const r = 1 + Math.floor(Math.random() * 6)
    setDie(r)
    setRolling(true)
    const target = Math.min(pos + r, SIZE)
    for (let p = pos + 1; p <= target; p++) {
      if (!mounted.current) return
      setPos(p)
      await sleep(180)
    }
    if (!mounted.current) return
    setRolling(false)

    if (target >= SIZE) { setWon(true); return }
    const ladder = LADDERS[target]
    const snake = SNAKES[target]
    if (ladder || snake) {
      const q = buildQuestion(pool, level)
      if (q) {
        setChallenge({ question: q, kind: ladder ? 'ladder' : 'snake', target: ladder ?? snake! })
      }
    }
  }

  function resolve(correct: boolean) {
    const c = challenge
    if (!c) return
    if (c.question.correctWord) report(c.question.correctWord, correct)
    setChallenge(null)
    if (correct) setStars((s) => s + 1)
    // Ladder: correct climbs. Snake: correct stays (rescued), wrong slides down.
    if (c.kind === 'ladder' && correct) {
      setPos(c.target)
      if (c.target >= SIZE) setWon(true)
    } else if (c.kind === 'snake' && !correct) {
      setPos(c.target)
    }
  }

  if (won) {
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 64 }}>🏁</Text>
        <Text style={styles.doneTitle}>رسیدی به بالا! 🎉</Text>
        <Text style={styles.doneSub}>{toPersianDigits(stars)} پاسخ درست دادی — عالی بود!</Text>
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
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>مارپله 🎲</Text>
          <Text style={styles.subtitle}>تاس بینداز و کلمه‌ها را یاد بگیر</Text>
        </View>
        <Text style={styles.stars}>⭐ {toPersianDigits(stars)}</Text>
      </View>

      {/* Board */}
      <View style={styles.board}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((n) => {
              const isLadder = n in LADDERS
              const isSnake = n in SNAKES
              const here = pos === n
              return (
                <View key={n} style={[styles.cell, isLadder && styles.ladderCell, isSnake && styles.snakeCell, here && styles.hereCell]}>
                  <Text style={styles.cellNum}>{toPersianDigits(n)}</Text>
                  {isLadder && !here && <Text style={styles.mark}>🪜</Text>}
                  {isSnake && !here && <Text style={styles.mark}>🐍</Text>}
                  {here && <Text style={styles.token}>🧒</Text>}
                </View>
              )
            })}
          </View>
        ))}
      </View>

      {/* Dice + roll */}
      <View style={styles.controls}>
        <View style={styles.die}>
          <Text style={styles.dieText}>{rolling ? '🎲' : die ? toPersianDigits(die) : '🎲'}</Text>
        </View>
        <Pressable style={[styles.rollButton, busy && { opacity: 0.5 }]} disabled={busy} onPress={roll}>
          <Text style={styles.rollText}>{pos === 0 ? 'شروع! 🎲' : 'تاس بینداز 🎲'}</Text>
        </Pressable>
      </View>

      {/* Challenge */}
      <Modal transparent visible={challenge !== null} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.challengePrompt}>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  stars: { fontSize: 15, fontFamily: fonts.bold, color: '#d97706' },
  board: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  ladderCell: { backgroundColor: '#dcfce7' },
  snakeCell: { backgroundColor: '#fee2e2' },
  hereCell: { backgroundColor: colors.primary },
  cellNum: { position: 'absolute', top: 4, right: 6, fontSize: 10, fontFamily: fonts.regular, color: colors.muted },
  mark: { fontSize: 20 },
  token: { fontSize: 24 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 'auto' },
  die: {
    width: 60, height: 60, borderRadius: 16, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  dieText: { fontSize: 30, fontFamily: fonts.bold, color: colors.text },
  rollButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
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
