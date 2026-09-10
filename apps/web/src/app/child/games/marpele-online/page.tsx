'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import type { Child, Word } from '@koodakbook/shared'
import { LADDERS, SIZE, SNAKES, buildQuestion, preferVisual, sleep, wordEmoji } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import { ClayButton, clayVars } from '@/components/child/clay'
import { type QuizQuestion } from '@/components/child/QuizCard'
import MarpeleBoard, { ChallengeModal, GameOverScreen, RollRow, TurnChip } from '@/components/child/MarpeleBoard'
import LoadingScreen from '@/components/child/LoadingScreen'
import { Icon } from '@/components/icons'

/* Online مارپله — web port of mobile's app/games/marpele-online.tsx (parity
 * phase 3, second pass). Invite an accepted friend and race turn-by-turn;
 * state is relayed over the socket after each turn (client-authoritative,
 * same as mobile — no server-side simulation, see backend's realtime.ts).
 * Only canned emoji reactions travel between players, never free text. */

// EMOJI-CONTENT: player tokens and reactions are game *pieces* and expressive
// content between two children — not UI affordances. They want real character
// art from pixel-wizards-charachters, not an outline glyph set.
const TOKEN_EMOJI = ['🧒', '👧']
const REACTIONS = ['👏', '🎉', '😄', '⭐', '💪']

type Phase = 'loading' | 'lobby' | 'waiting' | 'playing' | 'ended'
interface Friend { id: string; name: string; online: boolean }
interface RoomInfo { roomId: string; players: { childId: string; name: string; emoji: string }[]; myIndex: number }
interface GameState { positions: number[]; current: number; die: number | null; winner: number | null }

export default function MarpeleOnlinePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [me, setMe] = useState<{ id: string; name: string }>({ id: '', name: 'من' })
  const [level, setLevel] = useState(1)
  const [pool, setPool] = useState<Word[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [invite, setInvite] = useState<{ roomId: string; fromName: string; fromEmoji: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [endReason, setEndReason] = useState<'won' | 'lost' | 'left'>('won')

  // game
  const [positions, setPositions] = useState<number[]>([0, 0])
  const [current, setCurrent] = useState(0)
  const [die, setDie] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)
  const [challenge, setChallenge] = useState<{ question: QuizQuestion; kind: 'ladder' | 'snake'; target: number } | null>(null)
  const [reaction, setReaction] = useState<{ emoji: string; key: number } | null>(null)

  const roomRef = useRef<RoomInfo | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    mounted.current = true

    async function boot() {
      const [childRes, wordsRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<Word[]>('/api/words'),
      ])
      const child = pickChild(childRes.data ?? [])
      if (!child) { router.push('/child/home'); return }
      const lv = child.level ?? 1
      setMe({ id: child.id, name: child.name })
      setLevel(lv)
      const all = wordsRes.data ?? []
      const filtered = all.filter(w => w.stage <= lv + 1)
      setPool(preferVisual(filtered.length >= 4 ? filtered : all, w => !!(wordEmoji(w.english) || w.image_url)))

      const friendsRes = await api.get<{ id: string; name: string }[]>(`/api/friends/of/${child.id}`)
      setFriends((friendsRes.data ?? []).map(f => ({ ...f, online: false })))

      const socket = connectSocket(child.name, '🧒')
      if (!socket) { setNotice('اتصال برقرار نشد'); setPhase('lobby'); return }

      socket.on('connect', () => socket.emit('presence:friends'))
      socket.emit('presence:friends')
      socket.on('presence:online', ({ ids }: { ids: string[] }) => {
        if (!mounted.current) return
        setFriends(fs => fs.map(f => ({ ...f, online: ids.includes(f.id) })))
      })
      socket.on('presence:refresh', () => socket.emit('presence:friends'))
      socket.on('invite:incoming', (inv: { roomId: string; fromChildId: string; fromName: string; fromEmoji: string }) => {
        if (mounted.current) setInvite({ roomId: inv.roomId, fromName: inv.fromName, fromEmoji: inv.fromEmoji })
      })
      socket.on('invite:offline', () => { if (mounted.current) { setNotice('دوستت الان آنلاین نیست'); setPhase('lobby') } })
      socket.on('invite:declined', ({ name }: { name: string }) => { if (mounted.current) { setNotice(`${name} دعوت را رد کرد`); setPhase('lobby') } })
      socket.on('invite:gone', () => { if (mounted.current) { setNotice('دعوت منقضی شد'); setPhase('lobby') } })
      socket.on('game:start', ({ roomId, players, firstTurn }: { roomId: string; players: RoomInfo['players']; firstTurn: number }) => {
        if (!mounted.current) return
        const myIndex = players.findIndex(p => p.childId === child.id)
        roomRef.current = { roomId, players, myIndex }
        setPositions(players.map(() => 0))
        setCurrent(firstTurn)
        setDie(null)
        setChallenge(null)
        setInvite(null)
        setPhase('playing')
      })
      socket.on('game:state', ({ state }: { state: GameState }) => {
        if (!mounted.current) return
        setPositions(state.positions)
        setCurrent(state.current)
        setDie(state.die)
        if (state.winner !== null) {
          const won = roomRef.current?.myIndex === state.winner
          setEndReason(won ? 'won' : 'lost')
          setPhase('ended')
        }
      })
      socket.on('game:reaction', ({ emoji }: { emoji: string }) => {
        if (mounted.current) setReaction({ emoji, key: Date.now() })
      })
      socket.on('game:opponent-left', () => {
        if (mounted.current && roomRef.current) { setEndReason('left'); setPhase('ended') }
      })

      setPhase('lobby')
    }
    boot()
    return () => { mounted.current = false; disconnectSocket() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (!reaction) return
    const t = setTimeout(() => setReaction(null), 1600)
    return () => clearTimeout(t)
  }, [reaction])

  function inviteFriend(f: Friend) {
    if (!f.online) { setNotice(`${f.name} آنلاین نیست`); return }
    getSocket()?.emit('invite', { toChildId: f.id })
    setNotice(`منتظر ${f.name}…`)
    setPhase('waiting')
  }
  function acceptInvite() {
    if (!invite) return
    getSocket()?.emit('invite:accept', { roomId: invite.roomId })
    setInvite(null)
  }
  function declineInvite() {
    if (!invite) return
    getSocket()?.emit('invite:decline', { roomId: invite.roomId })
    setInvite(null)
  }

  const room = roomRef.current
  const myTurn = phase === 'playing' && room?.myIndex === current
  const canRoll = myTurn && !animating && !challenge

  function setPos(idx: number, val: number) {
    setPositions(p => { const n = [...p]; n[idx] = val; return n })
  }
  async function stepTo(idx: number, from: number, to: number) {
    for (let p = from + 1; p <= to; p++) { if (!mounted.current) return; setPos(idx, p); await sleep(150) }
  }
  function emitState(next: GameState) {
    getSocket()?.emit('game:move', { roomId: room?.roomId, state: next })
  }
  function finishTurn(pos: number[]) {
    const next = (current + 1) % (room?.players.length ?? 2)
    setCurrent(next)
    emitState({ positions: pos, current: next, die, winner: null })
  }

  async function roll() {
    if (!canRoll || !room) return
    const idx = room.myIndex
    setAnimating(true)
    const r = 1 + Math.floor(Math.random() * 6)
    setDie(r)
    const from = positions[idx]
    const target = Math.min(from + r, SIZE)
    await stepTo(idx, from, target)
    if (!mounted.current) return
    setAnimating(false)
    const pos = [...positions]; pos[idx] = target
    if (target >= SIZE) { win(idx, pos); return }
    const ladder = LADDERS[target], snake = SNAKES[target]
    if (ladder || snake) {
      const q = buildQuestion(pool, level)
      if (q) { setChallenge({ question: q, kind: ladder ? 'ladder' : 'snake', target: ladder ?? snake! }); return }
    }
    finishTurn(pos)
  }

  function resolve(correct: boolean) {
    const c = challenge
    if (!c || !room) return
    const idx = room.myIndex
    if (c.question.correctWord && me.id) {
      void api.post('/api/progress/word', { child_id: me.id, word_id: c.question.correctWord.id, status: 'practiced', result: correct ? 'correct' : 'incorrect' })
    }
    setChallenge(null)
    const pos = [...positions]
    if (c.kind === 'ladder' && correct) pos[idx] = c.target
    else if (c.kind === 'snake' && !correct) pos[idx] = c.target
    setPos(idx, pos[idx])
    if (pos[idx] >= SIZE) { win(idx, pos); return }
    finishTurn(pos)
  }

  function win(idx: number, pos: number[]) {
    setEndReason(room?.myIndex === idx ? 'won' : 'lost')
    emitState({ positions: pos, current, die, winner: idx })
    setPhase('ended')
  }

  function react(emoji: string) {
    getSocket()?.emit('game:react', { roomId: room?.roomId, emoji })
    setReaction({ emoji, key: Date.now() })
  }

  if (phase === 'loading') return <LoadingScreen message="در حال اتصال..." />

  if (phase === 'ended') {
    const title = endReason === 'won' ? 'تو بردی!' : endReason === 'lost' ? 'این بار دوستت برد!' : 'دوستت از بازی خارج شد'
    return (
      <GameOverScreen won={endReason === 'won'} title={title}>
        <ClayButton ramp="games" size="lg" onClick={() => setPhase('lobby')}>بازی دوباره</ClayButton>
      </GameOverScreen>
    )
  }

  if (phase === 'lobby' || phase === 'waiting') {
    return (
      <div className="min-h-screen child-bg pb-nav">
        <PageHeader title="بازی آنلاین" subtitle="یک دوست آنلاین را برای بازی دعوت کن" onBack={() => router.push('/child/games/marpele')} module="games" />

        <div className="px-4 pt-4 max-w-md mx-auto flex flex-col gap-3">
          {notice && <p /* amber-600 is 3.3:1 — under the floor for text this small. */
            className="text-center text-sm font-medium text-amber-700 persian-text">{notice}</p>}

          {friends.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-2.5 shadow-card">
              <span style={{ color: 'var(--ramp-games-ink)' }}><Icon name="partner" size="xl" /></span>
              <p className="text-center text-sm text-text-secondary persian-text leading-6">
                هنوز دوستی نداری. از حالت والدین با کد دوستی، دوست اضافه کن.
              </p>
            </div>
          ) : (
            friends.map(f => (
              <button
                key={f.id}
                disabled={phase === 'waiting'}
                onClick={() => inviteFriend(f)}
                className="flex items-center gap-2.5 bg-white rounded-2xl p-3.5 shadow-card disabled:opacity-60 text-right"
              >
                <span className="text-2xl">🧒</span>
                <span className="flex-1 font-bold text-text-primary">{f.name}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${f.online ? 'bg-emerald-500' : 'bg-border'}`} />
                <span className={`text-xs font-medium ${f.online ? 'text-emerald-600' : 'text-text-secondary'}`}>
                  {f.online ? 'آنلاین — دعوت کن' : 'آفلاین'}
                </span>
              </button>
            ))
          )}
        </div>

        <AnimatePresence>
          {invite && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col items-center gap-3"
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              >
                <span className="text-5xl">{invite.fromEmoji || '🧒'}</span>
                <p className="text-center font-bold text-text-primary persian-text">«{invite.fromName}» تو را به بازی مارپله دعوت کرد!</p>
                <div className="flex gap-2.5">
                  <button onClick={acceptInvite} style={clayVars('games')} className="clay text-white font-bold px-6 py-3 min-h-[48px]">بریم!</button>
                  <button onClick={declineInvite} className="bg-surface-subtle text-text-primary font-bold rounded-xl px-6 py-3">نه</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    )
  }

  // phase === 'playing'
  const cur = room?.players[current]
  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader
        title={myTurn ? 'نوبت توست!' : `نوبت ${cur?.name}…`}
        onBack={() => { getSocket()?.emit('game:leave', { roomId: room?.roomId }); router.push('/child/games/marpele') }}
        module="games"
      />

      <div className="px-4 pt-4 max-w-md mx-auto flex flex-col gap-4">
        <div className="flex gap-2 justify-center flex-wrap">
          {/* Same chip the solo board uses — this screen used to render its own
              copy in sky, so the identical state was two different colours
              depending on which مارپله you had opened. */}
          {room?.players.map((p, i) => (
            <TurnChip
              key={p.childId}
              emoji={TOKEN_EMOJI[i]}
              name={p.childId === me.id ? 'تو' : p.name}
              square={positions[i] ?? 0}
              active={i === current}
            />
          ))}
        </div>

        <MarpeleBoard positions={positions} emojis={positions.map((_, i) => TOKEN_EMOJI[i])} />

        {reaction && (
          <motion.span
            key={reaction.key}
            initial={{ opacity: 0, scale: 0.6, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -8 }}
            exit={{ opacity: 0 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-40 text-6xl z-40 pointer-events-none"
          >
            {reaction.emoji}
          </motion.span>
        )}

        <div className="flex justify-center gap-4">
          {REACTIONS.map(e => (
            <button key={e} onClick={() => react(e)} className="text-2xl">{e}</button>
          ))}
        </div>

        <RollRow die={die} rolling={animating} canRoll={canRoll} onRoll={roll} label={myTurn ? 'تاس بینداز!' : 'صبر کن…'} />
      </div>

      <AnimatePresence>
        {challenge && (
          <ChallengeModal
            key={challenge.target + '-' + (challenge.question.correctWord?.id ?? '')}
            prompt={challenge.kind === 'ladder' ? 'جواب بده تا از نردبان بالا بروی!' : 'جواب بده تا از مار فرار کنی!'}
            question={challenge.question}
            onResolve={resolve}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
