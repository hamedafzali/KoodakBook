'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { characterEmoji } from '@/lib/characterEmoji'
import { playTap, playSuccess, playComplete } from '@/lib/sounds'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import { ClayButton } from '@/components/child/clay'
import { type QuizQuestion } from '@/components/child/QuizCard'
import MarpeleBoard, { ChallengeModal, GameOverScreen, RollRow, TurnChip } from '@/components/child/MarpeleBoard'
import LoadingScreen from '@/components/child/LoadingScreen'
import type { AppCharacter, Child, Word } from '@koodakbook/shared'
import { LADDERS, SIZE, SNAKES, buildQuestion, preferVisual, sleep, toPersianDigits, wordEmoji } from '@koodakbook/shared'
import { Icon } from '@/components/icons'

/* مارپله برای یادگیری فارسی — web port of mobile's app/games/marpele.tsx
 * (solo/pass-and-play mode; online play against a friend lives at
 * ../marpele-online, ported from mobile's marpele-online.tsx). Humans use
 * Persian to climb ladders / escape snakes (a QuizCard); characters ride
 * pure luck. Every challenge the active child answers posts to the same
 * Leitner progress as lessons/review. */

// EMOJI-CONTENT: board-game tokens standing in for players. See marpele-online.
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
      <PageHeader title="مارپله" subtitle="با کی بازی می‌کنی؟" onBack={onBack} module="games" />

      <div className="px-4 pt-5 max-w-md mx-auto flex flex-col gap-5">
        <section>
          <h2 className="font-bold text-text-primary text-sm mb-2">بازیکن‌های دیگر (خواهر و برادر)</h2>
          {/* violet was this screen's own accent, related to nothing else in the
              app. The stepper is games-soft/games-ink now — the same pair every
              quiet control on a games screen uses. */}
          <div className="inline-flex items-center gap-4 bg-white rounded-2xl p-2.5 shadow-card">
            <button
              onClick={() => setExtraHumans(n => Math.max(0, n - 1))}
              aria-label="یک بازیکن کمتر"
              className="w-11 h-11 rounded-xl bg-games-soft text-games-ink text-xl font-bold flex items-center justify-center"
            >−</button>
            <span className="text-xl font-bold text-text-primary min-w-[1.5rem] text-center">{toPersianDigits(extraHumans)}</span>
            <button
              disabled={full}
              onClick={() => setExtraHumans(n => Math.min(MAX_PLAYERS - 1 - chosen.length, n + 1))}
              aria-label="یک بازیکن بیشتر"
              className="w-11 h-11 rounded-xl bg-games-soft text-games-ink text-xl font-bold flex items-center justify-center disabled:opacity-40"
            >+</button>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-text-primary text-sm mb-2">یا با دوستانت مسابقه بده</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {characters.map(ch => {
              const on = chosen.includes(ch.slug)
              return (
                <button
                  key={ch.slug}
                  disabled={!on && full}
                  onClick={() => toggleChar(ch.slug)}
                  aria-pressed={on}
                  className={`rounded-2xl p-3 flex flex-col items-center gap-1 border-2 transition-colors ${
                    on ? 'bg-games-bright border-games-deep' : 'bg-white border-transparent'} ${!on && full ? 'opacity-40' : ''}`}
                >
                  <span className="text-2xl" aria-hidden="true">{characterEmoji(ch)}</span>
                  <span className={`text-xs font-medium truncate w-full text-center ${on ? 'text-white' : 'text-text-primary'}`}>{ch.name_persian}</span>
                </button>
              )
            })}
          </div>
        </section>

        <p className="text-center text-sm text-text-secondary persian-text">
          {toPersianDigits(total)} بازیکن{total === 1 ? ' · تنها بازی می‌کنی' : ''}
        </p>

        <ClayButton ramp="games" size="lg" icon="play" onClick={start}>شروع بازی</ClayButton>

        {/* The secondary route out of this screen, so it stays an outline
            rather than a second clay slab — but on the games ramp, not the
            sky pair it used to borrow from no module at all. */}
        <Link
          href="/child/games/marpele-online"
          className="w-full py-3.5 rounded-2xl border-2 border-games-bright text-games-ink font-bold text-center"
        >
          بازی آنلاین با دوستان
        </Link>
      </div>

      <BottomNav />
    </div>
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
      <GameOverScreen
        won={childWon}
        token={childWon ? undefined : w.emoji}
        title={childWon ? 'تو بردی!' : `${w.name} برد!`}
        note={stars > 0 ? `${toPersianDigits(stars)} پاسخ درست دادی — عالی بود!` : undefined}
      >
        <ClayButton ramp="games" size="lg" onClick={onReplay}>دوباره بازی کن</ClayButton>
        <button onClick={onChangePlayers} className="w-full py-3.5 rounded-2xl border-2 border-border text-text-primary font-bold">
          تغییر بازیکن‌ها
        </button>
      </GameOverScreen>
    )
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader
        title="مارپله"
        module="games"
        /* Was a bare ⭐ glyph in amber-500 (2.4:1). The star is a UI count, so
           it comes from the icon set, on the rewards ramp like every other
           score in the app. */
        rightSlot={stars > 0 ? (
          <span className="flex items-center gap-1 text-sm font-bold" style={{ color: 'var(--ramp-rewards-ink)' }}>
            <Icon name="star" size="sm" strokeWidth={2.4} />
            {toPersianDigits(stars)}
          </span>
        ) : undefined}
      />

      <div className="px-4 pt-4 max-w-md mx-auto flex flex-col gap-4">
        <div className="flex gap-2 justify-center flex-wrap">
          {players.map((p, i) => (
            <TurnChip key={p.key} emoji={p.emoji} name={p.name} square={positions[i]} active={i === current} />
          ))}
        </div>

        <MarpeleBoard positions={positions} emojis={players.map(p => p.emoji)} />

        <RollRow
          die={die}
          rolling={animating}
          canRoll={canRoll}
          onRoll={humanRoll}
          label={cur?.kind === 'human' ? 'تاس بینداز!' : `${cur?.emoji} ${cur?.name} بازی می‌کند…`}
        />
      </div>

      <AnimatePresence>
        {challenge && (
          <ChallengeModal
            key={challenge.target + '-' + (challenge.question.correctWord?.id ?? '')}
            prompt={`${players[challenge.playerIdx].name}: ${
              challenge.kind === 'ladder' ? 'جواب بده تا از نردبان بالا بروی!' : 'جواب بده تا از مار فرار کنی!'}`}
            question={challenge.question}
            onResolve={resolve}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
