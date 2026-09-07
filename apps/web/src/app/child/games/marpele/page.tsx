'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { characterEmoji } from '@/lib/characterEmoji'
import { playTap, playSuccess, playComplete } from '@/lib/sounds'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import QuizCard, { type QuizQuestion } from '@/components/child/QuizCard'
import MarpeleBoard, { Confetti, Dice } from '@/components/child/MarpeleBoard'
import LoadingScreen from '@/components/child/LoadingScreen'
import type { AppCharacter, Child, Word } from '@koodakbook/shared'
import { LADDERS, SIZE, SNAKES, buildQuestion, preferVisual, sleep, toPersianDigits, wordEmoji } from '@koodakbook/shared'

/* مارپله برای یادگیری فارسی — web port of mobile's app/games/marpele.tsx
 * (solo/pass-and-play mode; the socket-based marpele-online.tsx variant is a
 * later pass, per project.md §12.3). Humans use Persian to climb ladders /
 * escape snakes (a QuizCard); characters ride pure luck. Every challenge the
 * active child answers posts to the same Leitner progress as lessons/review. */

const EXTRA_HUMAN_EMOJI = ['👧', '👦', '🧑']
const MAX_PLAYERS = 4

type Player = { key: string; kind: 'human' | 'character'; name: string; emoji: string; isActiveChild: boolean }

export default function MarpelePage() {
  const router = useRouter()
  const [pool, setPool] = useState<Word[] | null>(null)
  const [level, setLevel] = useState(1)
  const [childId, setChildId] = useState('')
  const [childName, setChildName] = useState('من')
  const [characters, setCharacters] = useState<AppCharacter[]>([])
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [wordsRes, childRes, charsRes] = await Promise.all([
        api.get<Word[]>('/api/words'),
        api.get<Child[]>('/api/children'),
        api.get<AppCharacter[]>('/api/characters'),
      ])
      const child = pickChild(childRes.data ?? [])
      setChildId(child?.id ?? '')
      const lv = child?.level ?? 1
      setLevel(lv)
      setChildName(child?.name ?? 'من')
      setCharacters(charsRes.data ?? [])
      const all = wordsRes.data ?? []
      const filtered = all.filter(w => w.stage <= lv + 1)
      const base = filtered.length >= 4 ? filtered : all
      setPool(preferVisual(base, w => !!(wordEmoji(w.english) || w.image_url)))
    }
    load()
  }, [router])

  if (!pool) return <LoadingScreen message="در حال آماده کردن تخته..." />

  if (!players) {
    return <Setup childName={childName} characters={characters} onStart={setPlayers} onBack={() => router.push('/child/home')} />
  }

  return (
    <Game
      key={run}
      players={players}
      pool={pool}
      level={level}
      childId={childId}
      onReplay={() => setRun(x => x + 1)}
      onChangePlayers={() => setPlayers(null)}
    />
  )
}

/* ── Setup: pick who's playing ──────────────────────────────────────────── */
function Setup({ childName, characters, onStart, onBack }: {
  childName: string
  characters: AppCharacter[]
  onStart: (players: Player[]) => void
  onBack: () => void
}) {
  const [extraHumans, setExtraHumans] = useState(0)
  const [chosen, setChosen] = useState<string[]>([])

  const total = 1 + extraHumans + chosen.length
  const full = total >= MAX_PLAYERS

  function toggleChar(slug: string) {
    setChosen(c => (c.includes(slug) ? c.filter(s => s !== slug) : full ? c : [...c, slug]))
  }

  function start() {
    const players: Player[] = [{ key: 'me', kind: 'human', name: childName, emoji: '🧒', isActiveChild: true }]
    for (let i = 0; i < extraHumans; i++) {
      players.push({ key: `h${i}`, kind: 'human', name: `بازیکن ${toPersianDigits(i + 2)}`, emoji: EXTRA_HUMAN_EMOJI[i] ?? '🧑', isActiveChild: false })
    }
    for (const slug of chosen) {
      const ch = characters.find(c => c.slug === slug)
      if (ch) players.push({ key: slug, kind: 'character', name: ch.name_persian, emoji: characterEmoji(ch), isActiveChild: false })
    }
    onStart(players)
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="مارپله 🎲" subtitle="با کی بازی می‌کنی؟" onBack={onBack} gradientClass="from-violet-500 to-purple-500" />

      <div className="px-4 pt-5 max-w-md mx-auto flex flex-col gap-5">
        <section>
          <h2 className="font-bold text-gray-700 text-sm mb-2">بازیکن‌های دیگر (خواهر و برادر)</h2>
          <div className="inline-flex items-center gap-4 bg-white rounded-2xl p-2.5 shadow-sm">
            <button
              onClick={() => setExtraHumans(n => Math.max(0, n - 1))}
              className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 text-xl font-bold flex items-center justify-center"
            >−</button>
            <span className="text-xl font-bold text-gray-800 min-w-[1.5rem] text-center">{toPersianDigits(extraHumans)}</span>
            <button
              disabled={full}
              onClick={() => setExtraHumans(n => Math.min(MAX_PLAYERS - 1 - chosen.length, n + 1))}
              className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 text-xl font-bold flex items-center justify-center disabled:opacity-40"
            >+</button>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-gray-700 text-sm mb-2">یا با دوستانت مسابقه بده</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {characters.map(ch => {
              const on = chosen.includes(ch.slug)
              return (
                <button
                  key={ch.slug}
                  disabled={!on && full}
                  onClick={() => toggleChar(ch.slug)}
                  className={`rounded-2xl p-3 flex flex-col items-center gap-1 border-2 transition-colors ${
                    on ? 'bg-violet-500 border-violet-500' : 'bg-white border-transparent'} ${!on && full ? 'opacity-40' : ''}`}
                >
                  <span className="text-2xl">{characterEmoji(ch)}</span>
                  <span className={`text-xs font-medium truncate w-full text-center ${on ? 'text-white' : 'text-gray-700'}`}>{ch.name_persian}</span>
                </button>
              )
            })}
          </div>
        </section>

        <p className="text-center text-sm text-gray-400 persian-text">
          {toPersianDigits(total)} بازیکن{total === 1 ? ' · تنها بازی می‌کنی' : ''}
        </p>

        <motion.button
          onClick={start}
          whileTap={{ scale: 0.96 }}
          className="w-full py-4 rounded-md bg-brand-gradient text-white font-bold text-lg shadow-md"
        >
          شروع بازی 🎲
        </motion.button>
      </div>

      <BottomNav />
    </div>
  )
}

/* ── A player's leaderboard chip; the current player glows ───────────────── */
function PlayerChip({ player, square, active }: { player: Player; square: number; active: boolean }) {
  return (
    <motion.div
      animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 1.2, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border-2 ${
        active ? 'bg-violet-500 border-yellow-300' : 'bg-white border-transparent'}`}
    >
      <span className="text-lg">{player.emoji}</span>
      <span className={`text-xs font-bold max-w-[70px] truncate ${active ? 'text-white' : 'text-gray-800'}`}>{player.name}</span>
      <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[22px] text-center ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-gray-700'}`}>
        {toPersianDigits(square)}
      </span>
    </motion.div>
  )
}

/* ── Game: N players take turns ───────────────────────────────────────────── */
type Challenge = { question: QuizQuestion; kind: 'ladder' | 'snake'; target: number; playerIdx: number }

function Game({ players, pool, level, childId, onReplay, onChangePlayers }: {
  players: Player[]
  pool: Word[]
  level: number
  childId: string
  onReplay: () => void
  onChangePlayers: () => void
}) {
  const router = useRouter()
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
    setPositions(p => { const n = [...p]; n[idx] = val; return n })
  }

  async function stepTo(idx: number, from: number, to: number) {
    for (let p = from + 1; p <= to; p++) {
      if (!mounted.current) return
      setPos(idx, p)
      await sleep(150)
    }
  }

  function win(idx: number) { winnerRef.current = true; setWinner(idx) }

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
    playTap()
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
    if (players[c.playerIdx].isActiveChild && c.question.correctWord && childId) {
      void api.post('/api/progress/word', {
        child_id: childId, word_id: c.question.correctWord.id, status: 'practiced', result: correct ? 'correct' : 'incorrect',
      })
    }
    setChallenge(null)
    if (correct) playSuccess()
    if (correct && players[c.playerIdx].isActiveChild) setStars(s => s + 1)
    let next = positions[c.playerIdx]
    if (c.kind === 'ladder' && correct) next = c.target
    else if (c.kind === 'snake' && !correct) next = c.target
    setPos(c.playerIdx, next)
    if (next >= SIZE) { win(c.playerIdx); return }
    advance(c.playerIdx)
  }

  useEffect(() => {
    if (winner !== null) playComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner])

  if (winner !== null) {
    const w = players[winner]
    const childWon = w.isActiveChild
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 child-bg p-6 text-center">
        <Confetti />
        <span className="text-8xl">{childWon ? '🏆' : w.emoji}</span>
        <h1 className="text-3xl font-bold text-gray-800">{childWon ? 'تو بردی! 🎉' : `${w.name} برد!`}</h1>
        {stars > 0 && <p className="text-gray-600 persian-text">{toPersianDigits(stars)} پاسخ درست دادی — عالی بود!</p>}
        <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
          <motion.button onClick={onReplay} whileTap={{ scale: 0.96 }} className="w-full py-4 rounded-md bg-brand-gradient text-white font-bold text-lg shadow-md">
            دوباره بازی کن 🔁
          </motion.button>
          <motion.button onClick={onChangePlayers} whileTap={{ scale: 0.96 }} className="w-full py-3.5 rounded-md border-2 border-slate-200 text-slate-600 font-bold">
            تغییر بازیکن‌ها
          </motion.button>
          <button onClick={() => router.push('/child/home')} className="text-sm text-slate-400 hover:text-slate-600 mt-1">برگشت به خانه 🏠</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader
        title="مارپله 🎲"
        gradientClass="from-violet-500 to-purple-500"
        rightSlot={stars > 0 ? <span className="text-sm font-bold text-amber-500">⭐ {toPersianDigits(stars)}</span> : undefined}
      />

      <div className="px-4 pt-4 max-w-md mx-auto flex flex-col gap-4">
        <div className="flex gap-2 justify-center flex-wrap">
          {players.map((p, i) => <PlayerChip key={p.key} player={p} square={positions[i]} active={i === current} />)}
        </div>

        <MarpeleBoard positions={positions} emojis={players.map(p => p.emoji)} />

        <div className="flex items-center gap-3.5">
          <Dice value={die} rolling={animating} />
          <motion.button
            onClick={humanRoll}
            disabled={!canRoll}
            whileTap={canRoll ? { scale: 0.96 } : {}}
            className={`flex-1 py-4 rounded-2xl font-bold text-lg text-white shadow-md transition-colors ${
              canRoll ? 'bg-violet-600' : 'bg-slate-300'}`}
          >
            {cur?.kind === 'human' ? 'تاس بینداز! 🎲' : `${cur?.emoji} ${cur?.name} بازی می‌کند…`}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {challenge && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-5"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl p-5 w-full max-w-sm flex flex-col gap-3"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            >
              <p className="text-center font-bold text-gray-800 persian-text">
                {players[challenge.playerIdx].name}:{' '}
                {challenge.kind === 'ladder' ? 'جواب بده تا از نردبان بالا بروی! 🪜' : 'جواب بده تا از مار فرار کنی! 🐍'}
              </p>
              <QuizCard
                key={challenge.target + '-' + (challenge.question.correctWord?.id ?? '')}
                question={challenge.question}
                onCorrect={() => resolve(true)}
                onIncorrect={() => resolve(false)}
                onFlashcardNext={() => resolve(true)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
