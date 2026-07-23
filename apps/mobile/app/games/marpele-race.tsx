import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, Word } from '@koodakbook/shared'
import { toPersianDigits, wordEmoji } from '@koodakbook/shared'
import QuizCard, { type QuizQuestion } from '@/components/QuizCard'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { LADDERS, SIZE, SNAKES, boardRows, buildQuestion, preferVisual, sleep } from '@/lib/marpele'
import { colors, fonts } from '@/lib/theme'

/* مارپله با سیمرغ (V2) — a turn-based race to the top. The child rolls and
 * uses Persian to climb ladders / escape snakes (answer a challenge); Simorgh
 * rolls too but is at the mercy of pure luck. So knowing the words is the
 * child's edge. Same board + progress posting as the solo game. */

type Turn = 'child' | 'simorgh'
type Challenge = { question: QuizQuestion; kind: 'ladder' | 'snake'; target: number }

export default function MarpeleRace() {
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
  return <Race key={run} pool={pool} level={level} childId={childId} insets={insets} onReplay={() => setRun((x) => x + 1)} />
}

function Race({ pool, level, childId, insets, onReplay }: {
  pool: Word[]
  level: number
  childId: string
  insets: { top: number; bottom: number }
  onReplay: () => void
}) {
  const [pos, setPos] = useState(0)         // child
  const [sPos, setSPos] = useState(0)       // simorgh
  const [turn, setTurn] = useState<Turn>('child')
  const [die, setDie] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [stars, setStars] = useState(0)
  const [winner, setWinner] = useState<Turn | null>(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const rows = useMemo(boardRows, [])
  const canRoll = turn === 'child' && !animating && !challenge && !winner

  function report(word: Word, correct: boolean) {
    if (!childId) return
    void api.post('/api/progress/word', {
      child_id: childId, word_id: word.id, status: 'practiced', result: correct ? 'correct' : 'incorrect',
    })
  }

  async function step(from: number, to: number, set: (n: number) => void) {
    for (let p = from + 1; p <= to; p++) {
      if (!mounted.current) return
      set(p)
      await sleep(160)
    }
  }

  async function simorghTurn() {
    setTurn('simorgh')
    setAnimating(true)
    await sleep(700)
    const r = 1 + Math.floor(Math.random() * 6)
    setDie(r)
    const cur = sPos
    const target = Math.min(cur + r, SIZE)
    await step(cur, target, setSPos)
    if (!mounted.current) return
    if (target >= SIZE) { setAnimating(false); setWinner('simorgh'); return }
    // Simorgh has no challenge — pure luck applies ladders/snakes.
    if (LADDERS[target]) {
      await sleep(400); setSPos(LADDERS[target])
      if (LADDERS[target] >= SIZE) { setAnimating(false); setWinner('simorgh'); return }
    } else if (SNAKES[target]) {
      await sleep(400); setSPos(SNAKES[target])
    }
    if (!mounted.current) return
    setAnimating(false)
    setTurn('child')
  }

  async function childRoll() {
    if (!canRoll) return
    setAnimating(true)
    const r = 1 + Math.floor(Math.random() * 6)
    setDie(r)
    const cur = pos
    const target = Math.min(cur + r, SIZE)
    await step(cur, target, setPos)
    if (!mounted.current) return
    setAnimating(false)

    if (target >= SIZE) { setWinner('child'); return }
    const ladder = LADDERS[target]
    const snake = SNAKES[target]
    if (ladder || snake) {
      const q = buildQuestion(pool, level)
      if (q) { setChallenge({ question: q, kind: ladder ? 'ladder' : 'snake', target: ladder ?? snake! }); return }
    }
    simorghTurn()
  }

  function resolve(correct: boolean) {
    const c = challenge
    if (!c) return
    if (c.question.correctWord) report(c.question.correctWord, correct)
    setChallenge(null)
    if (correct) setStars((s) => s + 1)
    let next = pos
    if (c.kind === 'ladder' && correct) next = c.target
    else if (c.kind === 'snake' && !correct) next = c.target
    setPos(next)
    if (next >= SIZE) { setWinner('child'); return }
    simorghTurn()
  }

  if (winner) {
    const childWon = winner === 'child'
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 64 }}>{childWon ? '🏆' : '🦅'}</Text>
        <Text style={styles.doneTitle}>{childWon ? 'تو بردی! 🎉' : 'سیمرغ برد!'}</Text>
        <Text style={styles.doneSub}>
          {childWon ? `${toPersianDigits(stars)} پاسخ درست — عالی بود!` : 'دوباره تلاش کن، این بار تو می‌بری!'}
        </Text>
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
          <Text style={styles.title}>مارپله با سیمرغ 🦅</Text>
          <Text style={[styles.turn, { color: turn === 'child' ? colors.primary : '#d97706' }]}>
            {turn === 'child' ? 'نوبت توست! 🧒' : 'نوبت سیمرغ… 🦅'}
          </Text>
        </View>
        <Text style={styles.stars}>⭐ {toPersianDigits(stars)}</Text>
      </View>

      <View style={styles.board}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((n) => {
              const isLadder = n in LADDERS
              const isSnake = n in SNAKES
              const here = pos === n
              const sHere = sPos === n
              return (
                <View key={n} style={[styles.cell, isLadder && styles.ladderCell, isSnake && styles.snakeCell, (here || sHere) && styles.hereCell]}>
                  <Text style={styles.cellNum}>{toPersianDigits(n)}</Text>
                  {isLadder && !here && !sHere && <Text style={styles.mark}>🪜</Text>}
                  {isSnake && !here && !sHere && <Text style={styles.mark}>🐍</Text>}
                  <View style={styles.tokens}>
                    {here && <Text style={styles.token}>🧒</Text>}
                    {sHere && <Text style={styles.token}>🦅</Text>}
                  </View>
                </View>
              )
            })}
          </View>
        ))}
      </View>

      <View style={styles.controls}>
        <View style={styles.die}>
          <Text style={styles.dieText}>{animating ? '🎲' : die ? toPersianDigits(die) : '🎲'}</Text>
        </View>
        <Pressable style={[styles.rollButton, !canRoll && { opacity: 0.5 }]} disabled={!canRoll} onPress={childRoll}>
          <Text style={styles.rollText}>{turn === 'child' ? 'تاس بینداز 🎲' : 'صبر کن…'}</Text>
        </Pressable>
      </View>

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
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  turn: { fontSize: 13, fontFamily: fonts.bold, marginTop: 2 },
  stars: { fontSize: 15, fontFamily: fonts.bold, color: '#d97706' },
  board: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  ladderCell: { backgroundColor: '#dcfce7' },
  snakeCell: { backgroundColor: '#fee2e2' },
  hereCell: { backgroundColor: colors.primarySoft },
  cellNum: { position: 'absolute', top: 4, right: 6, fontSize: 10, fontFamily: fonts.regular, color: colors.muted },
  mark: { fontSize: 20 },
  tokens: { flexDirection: 'row' },
  token: { fontSize: 20 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 'auto' },
  die: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
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
