import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, Word } from '@koodakbook/shared'
import { LADDERS, SIZE, SNAKES, buildQuestion, preferVisual, sleep, toPersianDigits, wordEmoji } from '@koodakbook/shared'
import QuizCard, { type QuizQuestion } from '@/components/QuizCard'
import MarpeleBoard, { Dice } from '@/components/MarpeleBoard'
import CelebrationOverlay from '@/components/CelebrationOverlay'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'
import { playSuccess, playTap } from '@/lib/uiSound'
import ScreenBackground from '@/components/ScreenBackground'
import { CharacterArt, ClayButton, ClayCard, ClaySurface, HostAvatar, TextButton } from '@/components/Clay'
import LoadState, { EmptyState } from '@/components/LoadState'
import { Icon } from '@/components/Icon'
import { RESULT_ART, ResultCard, boardFirstFrame } from '@/components/GameKit'
import { clay, colors, fonts, radii, ramps, scenery, spacing, textSize, textStart, ui } from '@/lib/theme'
import { RoomBand } from '@/components/RoomScene'
import BottomNav from '@/components/BottomNav'

/* Online مارپله — invite an accepted friend and race turn-by-turn. State is
 * relayed over the socket after each turn; only emoji reactions travel between
 * players (no chat). Reuses the same board + challenge as the offline game. */

const TOKEN_EMOJI = ['🧒', '👧']
const REACTIONS = ['👏', '🎉', '😄', '⭐', '💪']
// Screen-reader names for the emoji-only reaction buttons.
const REACTION_LABEL: Record<string, string> = {
  '👏': 'تشویق', '🎉': 'جشن', '😄': 'خنده', '⭐': 'ستاره', '💪': 'قوی باش',
}

type Phase = 'loading' | 'lobby' | 'waiting' | 'playing' | 'ended'
type EndReason = 'won' | 'lost' | 'left'
const END_TITLE: Record<EndReason, string> = {
  won: 'تو بردی!', lost: 'این بار دوستت برد!', left: 'دوستت از بازی خارج شد',
}
// The line under the title on the result card: what to feel / do next.
const END_SUB: Record<EndReason, string> = {
  won: 'آفرین! عالی بازی کردی', lost: 'دفعهٔ بعد شاید تو ببری!', left: 'می‌توانی یک دوست دیگر را دعوت کنی',
}
// What the playing screen stacks around the board (header, player strip,
// reactions, dice row, gaps, padding) -- only for the first frame's estimate.
const ONLINE_CHROME = 268
interface Friend { id: string; name: string; online: boolean }
interface RoomInfo { roomId: string; players: { childId: string; name: string; emoji: string }[]; myIndex: number }
interface GameState { positions: number[]; current: number; die: number | null; winner: number | null }

export default function MarpeleOnline() {
  const insets = useSafeAreaInsets()
  const [phase, setPhase] = useState<Phase>('loading')
  const [me, setMe] = useState<{ id: string; name: string }>({ id: '', name: 'من' })
  const [level, setLevel] = useState(1)
  const [pool, setPool] = useState<Word[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [invite, setInvite] = useState<{ roomId: string; fromName: string; fromEmoji: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [endReason, setEndReason] = useState<EndReason>('won')

  // game
  const [positions, setPositions] = useState<number[]>([0, 0])
  const [current, setCurrent] = useState(0)
  const [die, setDie] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)
  const [challenge, setChallenge] = useState<{ question: QuizQuestion; kind: 'ladder' | 'snake'; target: number } | null>(null)
  const [reaction, setReaction] = useState<{ emoji: string; key: number } | null>(null)
  // Measured by onLayout, drawn from the first frame (see marpele.tsx).
  const [boardArea, setBoardArea] = useState<{ w: number; h: number } | null>(null)
  const windowSize = useWindowDimensions()

  const roomRef = useRef<RoomInfo | null>(null)
  const mounted = useRef(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // The phase as the socket handlers see it: they are bound once, so they
  // can't read `phase`, and it has to change at once (not a render later) so
  // a second event or tap in the same frame sees it.
  const phaseRef = useRef<Phase>('loading')
  function go(p: Phase) { phaseRef.current = p; setPhase(p) }
  // A double tap lands before the re-render that disables the control.
  const rollingRef = useRef(false)
  const resolvedRef = useRef<object | null>(null)
  // The invite on screen, as the (bound-once) socket handlers see it.
  const inviteRef = useRef<{ roomId: string } | null>(null)
  function showInvite(inv: { roomId: string; fromName: string; fromEmoji: string } | null) { inviteRef.current = inv; setInvite(inv) }
  // The room this child said yes to. game:start carries no hint of WHY it
  // came, so it starts a game only for this room, or for this child's own
  // invite while it is still waiting on it; any other start (an invite this
  // child cancelled, a second friend saying yes mid-game) is left at once so
  // the friend isn't stranded in a game nobody is playing.
  const acceptedRoomRef = useRef<string | null>(null)
  // The friend this child is waiting on: after a cancel and a new invite, a
  // late yes from the FIRST friend would otherwise start the wrong game.
  const invitedRef = useRef<string | null>(null)
  // Bumped per game: a move still stepping when its game ended (the friend
  // left) must not keep moving a token on the next game's board.
  const gameSeqRef = useRef(0)
  // What the last roll did, said together with the turn change it causes (one
  // announcement; two in a row cut each other off on iOS).
  const lastRollRef = useRef<string | null>(null)
  // The realtime link. socket.io keeps retrying on its own; this only says so.
  const [linkDown, setLinkDown] = useState(false)

  useEffect(() => {
    mounted.current = true
    // Lifecycle (2026-09-25 hardening): `cancelled` is this run's own flag.
    // Before it, leaving the screen while boot() was still awaiting let boot
    // go on to open a socket AFTER the cleanup's disconnectSocket() had run:
    // a connection nobody closed, left online (visible to friends, receiving
    // invites) with listeners bound to a dead screen. Listeners are now also
    // removed explicitly on unmount, each with the handler it was added with.
    let cancelled = false
    let attached: { socket: NonNullable<Awaited<ReturnType<typeof connectSocket>>>; handlers: [string, (...args: any[]) => void][] } | null = null
    async function boot() {
      const childId = await getActiveChildId()
      if (cancelled) return
      if (!childId) { router.replace('/children'); return }
      const [childRes, wordsRes, friendsRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<Word[]>('/api/words'),
        api.get<{ id: string; name: string }[]>(`/api/friends/of/${childId}`),
      ])
      if (cancelled) return
      // A failed friends list used to show «هنوز دوستی نداری» (an error as the
      // empty state), and a failed word list a game with no questions.
      const failed = friendsRes.error ?? wordsRes.error ?? childRes.error
      if (failed) { setLoadError(failed); return }
      const child = childRes.data?.find((c) => c.id === childId)
      const lv = child?.level ?? 1
      setMe({ id: childId, name: child?.name ?? 'من' })
      setLevel(lv)
      const all = wordsRes.data ?? []
      const filtered = all.filter((w) => w.stage <= lv + 1)
      setPool(preferVisual(filtered.length >= 4 ? filtered : all, (w) => !!(wordEmoji(w.english) || w.image_url)))
      setFriends((friendsRes.data ?? []).map((f) => ({ ...f, online: false })))

      const socket = await connectSocket(child?.name ?? 'من', '🧒')
      if (cancelled) {
        // Closed while connecting: this connection is ours alone, close it.
        if (socket && getSocket() === socket) disconnectSocket()
        return
      }
      // Was setNotice only, which the loading phase never shows: a spinner
      // forever. Now LoadState's message and retry.
      if (!socket) { setLoadError('اتصال برقرار نشد. دوباره تلاش کن'); return }

      // Same events and handlers as before, registered from one table so the
      // cleanup can remove exactly these.
      const handlers: [string, (...args: any[]) => void][] = [
        ['connect', () => { if (mounted.current) setLinkDown(false); socket.emit('presence:friends') }],
        // Was silent: a rejected or dropped connection left the lobby showing
        // every friend offline with nothing saying why.
        ['connect_error', () => { if (mounted.current) setLinkDown(true) }],
        ['disconnect', () => { if (mounted.current) setLinkDown(true) }],
        ['presence:online', ({ ids }: { ids: string[] }) => {
          if (!mounted.current) return
          setFriends((fs) => fs.map((f) => ({ ...f, online: ids.includes(f.id) })))
        }],
        // A friend just came online / went offline — re-query.
        ['presence:refresh', () => socket.emit('presence:friends')],
        ['invite:incoming', (inv: { roomId: string; fromChildId: string; fromName: string; fromEmoji: string }) => {
          if (!mounted.current) return
          // Mid-game (the modal isn't shown there, and it used to pop up
          // stale after the game) or while another invite is on screen: say
          // no at once, so the friend isn't left waiting on nobody.
          if (phaseRef.current === 'playing' || inviteRef.current) {
            socket.emit('invite:decline', { roomId: inv.roomId })
            return
          }
          showInvite({ roomId: inv.roomId, fromName: inv.fromName, fromEmoji: inv.fromEmoji })
        }],
        // Only a lobby/waiting screen goes back to the lobby: a late reply to
        // an old invite must not pull a child out of a game or its result.
        ['invite:offline', () => { if (mounted.current && phaseRef.current === 'waiting') { setNotice('دوستت الان آنلاین نیست'); go('lobby') } }],
        ['invite:declined', ({ name }: { name: string }) => { if (mounted.current && phaseRef.current === 'waiting') { setNotice(`${name} دعوت را رد کرد`); go('lobby') } }],
        // Sent only to a child who just said yes; from the result screen too
        // now that an invite can be accepted there.
        ['invite:gone', () => {
          if (!mounted.current) return
          const accepting = acceptedRoomRef.current !== null
          acceptedRoomRef.current = null
          if (phaseRef.current === 'waiting' || phaseRef.current === 'lobby' || (phaseRef.current === 'ended' && accepting)) { setNotice('دعوت منقضی شد'); go('lobby') }
        }],
        ['game:start', ({ roomId, players, firstTurn }: { roomId: string; players: RoomInfo['players']; firstTurn: number }) => {
          if (!mounted.current) return
          const myIndex = players.findIndex((p) => p.childId === childId)
          const mine = roomId === acceptedRoomRef.current
            || (phaseRef.current === 'waiting' && myIndex === 0 && players[1]?.childId === invitedRef.current)
          if (!mine || phaseRef.current === 'playing') {
            socket.emit('game:leave', { roomId })
            return
          }
          acceptedRoomRef.current = null
          invitedRef.current = null
          gameSeqRef.current += 1
          rollingRef.current = false
          lastRollRef.current = null
          roomRef.current = { roomId, players, myIndex }
          setPositions(players.map(() => 0))
          setCurrent(firstTurn)
          setDie(null)
          // A roll interrupted by the last game's end left this true, and a
          // new game then never offered this child a roll.
          setAnimating(false)
          setChallenge(null)
          showInvite(null)
          setNotice(null)
          go('playing')
        }],
        ['game:state', ({ state }: { state: GameState }) => {
          // Only the game in progress: the relay carries no room id.
          if (!mounted.current || phaseRef.current !== 'playing') return
          if (state.die !== null && state.winner === null) {
            const who = roomRef.current?.players.find((_, i) => i !== roomRef.current?.myIndex)?.name ?? 'دوستت'
            lastRollRef.current = `${who}: ${toPersianDigits(state.die)}`
          }
          setPositions(state.positions)
          setCurrent(state.current)
          setDie(state.die)
          if (state.winner !== null) {
            const won = roomRef.current?.myIndex === state.winner
            setEndReason(won ? 'won' : 'lost')
            go('ended')
          }
        }],
        ['game:reaction', ({ emoji }: { emoji: string }) => {
          if (!mounted.current || phaseRef.current !== 'playing') return
          setReaction({ emoji, key: Date.now() })
          const label = REACTION_LABEL[emoji]
          if (label) AccessibilityInfo.announceForAccessibility(`دوستت فرستاد: ${label}`)
        }],
        // Only while playing: on the result screen it used to overwrite «تو
        // بردی!» with «دوستت از بازی خارج شد» when the friend left theirs.
        ['game:opponent-left', () => {
          if (mounted.current && roomRef.current && phaseRef.current === 'playing') { setEndReason('left'); go('ended') }
        }],
      ]
      for (const [event, fn] of handlers) socket.on(event, fn)
      attached = { socket, handlers }
      socket.emit('presence:friends')

      go('lobby')
    }
    boot().catch(() => { if (!cancelled) setLoadError('اتصال برقرار نشد. دوباره تلاش کن') })
    return () => {
      cancelled = true
      mounted.current = false
      // Leaving mid-game without ✕ (swipe / hardware back): tell the friend,
      // as ✕ does. The server doesn't on disconnect (see the sprint report).
      if (phaseRef.current === 'playing' && roomRef.current) {
        getSocket()?.emit('game:leave', { roomId: roomRef.current.roomId })
        roomRef.current = null
      }
      if (attached) for (const [event, fn] of attached.handlers) attached.socket.off(event, fn)
      disconnectSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  // auto-clear a received reaction
  useEffect(() => {
    if (!reaction) return
    const t = setTimeout(() => setReaction(null), 1600)
    return () => clearTimeout(t)
  }, [reaction])

  function inviteFriend(f: Friend) {
    if (phaseRef.current !== 'lobby') return   // one invite at a time
    // socket.io would queue the invite until the link is back, and send it
    // then, long after the child gave up on it.
    if (linkDown) { setNotice('اتصال برقرار نیست؛ کمی بعد دوباره امتحان کن'); return }
    if (!f.online) { setNotice(`${f.name} آنلاین نیست`); return }
    invitedRef.current = f.id
    getSocket()?.emit('invite', { toChildId: f.id })
    setNotice(`منتظر ${f.name}…`)
    go('waiting')
  }
  // The server has no way to withdraw an invite, so cancelling is local: back
  // to the lobby, and a late «yes» to it is left at once (game:start above).
  function cancelInvite() {
    if (phaseRef.current !== 'waiting') return
    invitedRef.current = null
    setNotice(null)
    go('lobby')
  }
  function acceptInvite() {
    if (!invite) return
    acceptedRoomRef.current = invite.roomId
    getSocket()?.emit('invite:accept', { roomId: invite.roomId })
    showInvite(null)
  }
  function declineInvite() {
    if (!invite) return
    getSocket()?.emit('invite:decline', { roomId: invite.roomId })
    showInvite(null)
  }

  // ── turn logic (mine) ──────────────────────────────────────────────────
  const room = roomRef.current
  const myTurn = phase === 'playing' && room?.myIndex === current
  const canRoll = myTurn && !animating && !challenge

  function setPos(idx: number, val: number) {
    setPositions((p) => { const n = [...p]; n[idx] = val; return n })
  }
  // Stops when the screen closes or this game ends (the friend left).
  async function stepTo(idx: number, from: number, to: number) {
    const seq = gameSeqRef.current
    for (let p = from + 1; p <= to; p++) {
      if (!mounted.current || phaseRef.current !== 'playing' || gameSeqRef.current !== seq) return
      setPos(idx, p)
      await sleep(150)
    }
  }
  function emitState(next: GameState) {
    getSocket()?.emit('game:move', { roomId: room?.roomId, state: next })
  }
  // `rolled`: roll() passes the value it just rolled. `die` in this closure is
  // still the render's value from BEFORE setDie(r), so a plain roll used to
  // send the opponent the previous turn's die. resolve() runs a render later,
  // where `die` is already current, so it keeps the default.
  function finishTurn(pos: number[], rolled: number | null = die) {
    const next = (current + 1) % (room?.players.length ?? 2)
    setCurrent(next)
    emitState({ positions: pos, current: next, die: rolled, winner: null })
  }

  async function roll() {
    if (!canRoll || !room || rollingRef.current) return
    rollingRef.current = true
    playTap()
    const idx = room.myIndex
    setAnimating(true)
    const r = 1 + Math.floor(Math.random() * 6)
    setDie(r)
    const seq = gameSeqRef.current
    const from = positions[idx]
    const target = Math.min(from + r, SIZE)
    await stepTo(idx, from, target)
    if (!mounted.current || gameSeqRef.current !== seq) return
    rollingRef.current = false
    setAnimating(false)
    if (phaseRef.current !== 'playing') return
    // Said with the turn change it leads to (see lastRollRef).
    lastRollRef.current = `تاس: ${toPersianDigits(r)}`
    const pos = [...positions]; pos[idx] = target
    if (target >= SIZE) { win(idx, pos, r); return }
    const ladder = LADDERS[target], snake = SNAKES[target]
    if (ladder || snake) {
      const q = buildQuestion(pool, level)
      // The challenge modal takes focus and reads its own prompt.
      if (q) { lastRollRef.current = null; setChallenge({ question: q, kind: ladder ? 'ladder' : 'snake', target: ladder ?? snake! }); return }
    }
    finishTurn(pos, r)
  }

  function resolve(correct: boolean) {
    const c = challenge
    // Once per challenge: a double tap in QuizCard answers twice.
    if (!c || !room || resolvedRef.current === c) return
    resolvedRef.current = c
    const idx = room.myIndex
    if (c.question.correctWord && me.id) {
      void api.post('/api/progress/word', { child_id: me.id, word_id: c.question.correctWord.id, status: 'practiced', result: correct ? 'correct' : 'incorrect' })
    }
    // QuizCard's answer delay outlives its modal: if the friend left (or the
    // screen closed) meanwhile, don't move or emit into a finished room.
    if (!mounted.current || phaseRef.current !== 'playing') return
    setChallenge(null)
    if (correct) playSuccess(); else playTap()
    const pos = [...positions]
    if (c.kind === 'ladder' && correct) pos[idx] = c.target
    else if (c.kind === 'snake' && !correct) pos[idx] = c.target
    setPos(idx, pos[idx])
    if (pos[idx] >= SIZE) { win(idx, pos); return }
    finishTurn(pos)
  }

  function win(idx: number, pos: number[], rolled: number | null = die) {
    // The win sound is CelebrationOverlay's, which mounts with «تو بردی!».
    setEndReason(room?.myIndex === idx ? 'won' : 'lost')
    emitState({ positions: pos, current, die: rolled, winner: idx })
    go('ended')
  }

  function react(emoji: string) {
    getSocket()?.emit('game:react', { roomId: room?.roomId, emoji })
    setReaction({ emoji, key: Date.now() })
  }

  // Whose turn it is changes with no tap from this child (the friend's move
  // arrives over the socket), so a screen reader hears it.
  const turnName = room?.players[current]?.name
  useEffect(() => {
    if (phase !== 'playing') return
    const turn = myTurn ? 'نوبت توست' : `نوبت ${turnName ?? 'دوستت'}`
    const lead = lastRollRef.current
    lastRollRef.current = null
    AccessibilityInfo.announceForAccessibility(lead ? `${lead}. ${turn}` : turn)
  }, [phase, myTurn, turnName])

  // The result replaces the board with no focus change: said once, here.
  useEffect(() => {
    if (phase !== 'ended') return
    AccessibilityInfo.announceForAccessibility(END_TITLE[endReason])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── render ─────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        <LoadState
          error={loadError}
          onRetry={() => { setLoadError(null); setAttempt((a) => a + 1) }}
          onBack={() => goBack('/games')}
        />
      </ScreenBackground>
    )
  }

  // One modal for the lobby and the result screen: a friend's «play again?»
  // can be answered from either. Android back = «نه».
  const inviteModal = (
    <Modal transparent visible={!!invite} animationType="fade" onRequestClose={declineInvite}>
      <View style={styles.modalBackdrop}>
        <View style={styles.inviteSlot} accessibilityViewIsModal>
          <ClaySurface ramp={ramps.games} tone="soft" radius={radii.xl} faceStyle={styles.inviteCard}>
            <HostAvatar ramp={ramps.games} size={80} emoji={invite?.fromEmoji ?? '🧒'} />
            <Text style={styles.inviteText} accessibilityRole="header">«{invite?.fromName}» تو را به بازی مارپله دعوت کرد!</Text>
            <View style={styles.inviteActions}>
              <ClayButton ramp={ramps.games} label="بریم!" emoji="🎲" accessibilityLabel="بریم، قبول" onPress={acceptInvite} style={styles.inviteButton} />
              <ClayButton ramp={ramps.games} tone="soft" label="نه" accessibilityLabel="نه، ممنون" onPress={declineInvite} style={styles.inviteButton} />
            </View>
          </ClaySurface>
        </View>
      </View>
    </Modal>
  )

  if (phase === 'ended') {
    return (
      <ScreenBackground variant="warm" style={[styles.center, styles.done]}>
        {/* CelebrationOverlay, not bare Confetti: hides the falling emoji
            from screen readers and plays the win sound once. */}
        {endReason === 'won' && <CelebrationOverlay />}
        {/* The shared finish card (GameKit): تندپا, games' host, proud for
            a win, encouraging otherwise. */}
        <ResultCard
          ramp={ramps.games}
          art={<CharacterArt character="tondpa" emotion={endReason === 'won' ? 'proud' : 'encouraging'} size={RESULT_ART} />}
          title={END_TITLE[endReason]}
          sub={END_SUB[endReason]}
        >
        {/* Forget the finished room on the way back to the lobby: its
            game:opponent-left (the other child leaving the result screen)
            used to find roomRef still set and throw this child out of the
            lobby onto «دوستت از بازی خارج شد». */}
        {/* Not a rematch (there is none to offer: the friend may have left):
            back to the lobby to invite someone, which the label now says. */}
        <ClayButton ramp={ramps.games} label={endReason === 'left' ? 'دعوت یک دوست' : 'دعوت دوباره'} onPress={() => { roomRef.current = null; setNotice(null); go('lobby') }} />
        <ClayButton ramp={ramps.games} tone="soft" label="برگشت" onPress={() => goBack('/games')} />
        </ResultCard>
        {inviteModal}
      </ScreenBackground>
    )
  }

  if (phase === 'lobby' || phase === 'waiting') {
    return (
      <ScreenBackground variant="warm">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 92 }]}>
        {/* The rooms' shared header (RoomScene): تندپا introduces the lobby
            in a speech bubble, as on the games hub. Back lands on /games. */}
        <View style={styles.bandWrap}>
          <RoomBand
            ramp={ramps.games}
            character="tondpa"
            size="tall"
            topInset={insets.top}
            fallback="/games"
            title="بازی آنلاین"
            speechTitle="با دوستت مسابقه بده!"
            speech="یک دوست آنلاین را برای بازی دعوت کن"
          />
        </View>

        {linkDown && (
          <Text style={styles.notice} accessibilityLiveRegion="polite">اتصال قطع شده؛ داریم دوباره وصل می‌شویم…</Text>
        )}
        {/* Waiting on a friend is a card of its own: a spinner, who we're
            waiting for, and the way out. */}
        {phase === 'waiting' ? (
          <ClaySurface ramp={ramps.games} tone="soft" radius={radii.lg} faceStyle={styles.waitingFace}>
            <ActivityIndicator color={ramps.games.deep} accessibilityElementsHidden importantForAccessibility="no" />
            {notice && <Text style={styles.waitingText} accessibilityLiveRegion="polite">{notice}</Text>}
            {/* The server can't withdraw an invite, and it never times out:
                this was a wait with no way out but leaving the screen. */}
            <TextButton label="لغو دعوت" onPress={cancelInvite} color={ramps.games.ink} />
          </ClaySurface>
        ) : (
          notice && <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>
        )}

        {friends.length === 0 ? (
          // Empty (no friends yet) is not an error: a failed list goes to
          // LoadState before this screen is ever shown.
          <EmptyState
            title="هنوز دوستی نداری"
            body="از حالت والدین با کد دوستی، دوست اضافه کن."
            character="tondpa"
            emotion="encouraging"
            ramp={ramps.games}
          />
        ) : (
          friends.map((f) => (
            <ClayCard
              key={f.id}
              ramp={ramps.games}
              accessibilityLabel={`${f.name}، ${f.online ? 'آنلاین — دعوت کن' : 'آفلاین'}`}
              disabled={phase === 'waiting'}
              onPress={() => inviteFriend(f)}
              faceStyle={styles.friendFace}
            >
              <HostAvatar ramp={ramps.games} size={48} emoji="🧒" />
              <Text style={styles.friendName}>{f.name}</Text>
              {/* Status is words as well as the dot, so the dot is only a
                  hint (the offline grey, colors.border, barely shows on the
                  soft face, by design). The words are ui.success (9:1) or
                  ui.textMuted (6.2:1) on the games soft face;
                  colors.success as text is ~2:1. */}
              <View style={[styles.status, { backgroundColor: f.online ? ui.successSoft : colors.card }]}>
                <View style={[styles.dot, { backgroundColor: f.online ? colors.success : ui.faint }]} />
                <Text style={[styles.friendStatus, { color: f.online ? ui.success : ui.textMuted }]}>
                  {f.online ? 'آنلاین — دعوت کن' : 'آفلاین'}
                </Text>
              </View>
            </ClayCard>
          ))
        )}

        {inviteModal}
      </ScrollView>
      <BottomNav />
      </ScreenBackground>
    )
  }

  // phase === 'playing'
  const cur = room?.players[current]
  const area = boardArea ?? boardFirstFrame(windowSize, insets, ONLINE_CHROME)
  return (
    <ScreenBackground variant="warm" style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="خروج از بازی"
          onPress={() => { getSocket()?.emit('game:leave', { roomId: room?.roomId }); roomRef.current = null; goBack('/games') }}
          hitSlop={10}
        >
          {({ pressed }) => <View style={[styles.closeDisc, pressed && styles.pressed]}><Icon name="close" color={scenery.ink} size={20} strokeWidth={2.5} /></View>}
        </Pressable>
        {/* Whose turn, as a pill: bright when it is this child's. */}
        <View style={[styles.turnPill, myTurn && styles.turnPillMine]}>
          <Text style={[styles.turn, { color: myTurn ? ramps.games.ink : colors.text }]}>
            {myTurn ? 'نوبت توست!' : `نوبت ${cur?.name ?? 'دوستت'}…`}
          </Text>
        </View>
        {/* Balances the close disc so the pill sits in the middle. */}
        <View style={styles.headerSpacer} />
      </View>
      {linkDown && (
        <Text style={styles.notice} accessibilityLiveRegion="polite">اتصال قطع شده؛ داریم دوباره وصل می‌شویم…</Text>
      )}

      <View style={styles.strip}>
        {room?.players.map((p, i) => (
          <View
            key={p.childId}
            accessible
            accessibilityLabel={`${p.childId === me.id ? 'تو' : p.name}، خانهٔ ${toPersianDigits(positions[i] ?? 0)}${i === current ? '، نوبت' : ''}`}
            style={[styles.pcard, i === current && styles.pcardActive]}
          >
            <Text style={styles.pcardEmoji}>{TOKEN_EMOJI[i]}</Text>
            <Text style={[styles.pcardName, i === current && { color: ramps.games.ink }]} numberOfLines={1}>
              {p.childId === me.id ? 'تو' : p.name}
            </Text>
            <View style={styles.pcardBadge}><Text style={styles.pcardBadgeText}>{toPersianDigits(positions[i] ?? 0)}</Text></View>
          </View>
        ))}
      </View>

      {/* Measured like the offline game, capped at the old fixed 360x420, so
          a short phone no longer pushes the controls off the bottom. */}
      <View
        style={styles.boardArea}
        onLayout={(e) => setBoardArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {area.h > 0 && (
          <MarpeleBoard
            positions={positions}
            emojis={positions.map((_, i) => TOKEN_EMOJI[i])}
            maxWidth={Math.min(360, area.w)}
            maxHeight={Math.min(420, area.h)}
            accessibilityLabel={`صفحهٔ مارپله: ${(room?.players ?? []).map((p, i) => `${p.childId === me.id ? 'تو' : p.name} در خانهٔ ${toPersianDigits(positions[i] ?? 0)}`).join('، ')}`}
          />
        )}
      </View>

      {/* Decorative: a received reaction is announced in words (game:reaction). */}
      {reaction && <Text style={styles.reactionFloat} allowFontScaling={false} importantForAccessibility="no" accessibilityElementsHidden>{reaction.emoji}</Text>}

      <View style={styles.reactionsRow}>
        {REACTIONS.map((e) => (
          <Pressable key={e} onPress={() => react(e)} accessibilityRole="button" accessibilityLabel={REACTION_LABEL[e] ?? e}>
            {({ pressed }) => (
              <ClaySurface ramp={ramps.games} tone="soft" pressed={pressed} radius={radii.pill} edge={clay.edgeSm} faceStyle={styles.reactionFace}>
                <Text style={styles.reactionGlyph} allowFontScaling={false}>{e}</Text>
              </ClaySurface>
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.controls}>
        <Dice value={die} rolling={animating} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={myTurn ? 'تاس بینداز' : 'صبر کن، نوبت دوستت است'}
          accessibilityState={{ disabled: !canRoll }}
          style={styles.rollSlot}
          disabled={!canRoll}
          onPress={roll}
        >
          {({ pressed }) => (
            <ClaySurface ramp={ramps.games} tone={canRoll ? 'bright' : 'soft'} pressed={pressed && canRoll} radius={radii.lg} faceStyle={styles.rollFace}>
              <Text style={styles.rollText} numberOfLines={1}>{myTurn ? 'تاس بینداز! 🎲' : 'صبر کن…'}</Text>
            </ClaySurface>
          )}
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
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: spacing.md, gap: spacing.sm + 2 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm + spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  // The same white 44pt disc as ScreenHeader's back button.
  closeDisc: {
    width: ui.hit, height: ui.hit, borderRadius: radii.pill, backgroundColor: colors.card,
    borderWidth: 2, borderColor: ui.divider, alignItems: 'center', justifyContent: 'center',
  },
  // Same press feedback as ScreenHeader's back disc (it had none).
  pressed: { opacity: 0.6 },
  turnPill: {
    flex: 1, minHeight: ui.hit, borderRadius: radii.pill, backgroundColor: colors.card, borderWidth: 2,
    borderColor: ramps.games.soft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md,
  },
  turnPillMine: { backgroundColor: ramps.games.bright, borderColor: ramps.games.deep },
  turn: { fontSize: textSize.small, fontFamily: fonts.display, textAlign: 'center' },
  headerSpacer: { width: ui.hit },
  // Was #d97706 (~2.8:1 on the page gradient); brand ink clears AA.
  notice: { fontSize: textSize.caption, fontFamily: fonts.bold, color: ramps.brand.ink, textAlign: 'center' },
  // Full-bleed band; the friend cards keep the gutter.
  bandWrap: { marginHorizontal: -spacing.md },
  waitingFace: { alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  waitingText: { fontSize: textSize.small, fontFamily: fonts.bold, color: ramps.games.ink, textAlign: 'center' },
  // minHeight, and the status sits under the name's row end in its own
  // column: at 320pt / large text the name wraps instead of being squeezed
  // to a sliver by «آنلاین — دعوت کن».
  friendFace: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm + 2, rowGap: spacing.xs, padding: spacing.sm + spacing.xs, minHeight: 72 },
  friendName: { flexGrow: 1, flexShrink: 1, minWidth: 96, fontSize: textSize.body, fontFamily: fonts.display, color: ramps.games.ink, textAlign: textStart },
  status: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, borderRadius: radii.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  dot: { width: 10, height: 10, borderRadius: radii.pill },
  friendStatus: { fontSize: textSize.caption, fontFamily: fonts.medium },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  pcard: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, backgroundColor: colors.card, borderRadius: radii.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm + 2, borderWidth: 2, borderColor: ramps.games.soft, minHeight: ui.hit },
  pcardActive: { backgroundColor: ramps.games.bright, borderColor: ramps.games.deep },
  pcardEmoji: { fontSize: textSize.body },
  pcardName: { fontSize: textSize.caption, fontFamily: fonts.bold, color: colors.text, maxWidth: 90 },
  pcardBadge: { backgroundColor: ramps.games.soft, borderRadius: radii.pill, paddingHorizontal: spacing.xs + 3, minWidth: 22, alignItems: 'center' },
  pcardBadgeText: { fontSize: textSize.caption, fontFamily: fonts.bold, color: colors.text },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reactionFloat: { position: 'absolute', alignSelf: 'center', bottom: 160, fontSize: textSize.display * 1.6 },
  reactionsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  // 46pt: five reactions + four gaps fit a 320pt phone's 288pt row (262pt).
  reactionFace: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  reactionGlyph: { fontSize: textSize.h2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  rollSlot: { flex: 1 },
  rollFace: { minHeight: 60, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  rollText: { color: ramps.games.ink, fontSize: textSize.body, fontFamily: fonts.display, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: ui.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard: { backgroundColor: colors.bg, borderRadius: radii.lg, padding: spacing.md + spacing.xs, width: '100%', maxWidth: 380, gap: spacing.sm + spacing.xs },
  inviteSlot: { width: '100%', maxWidth: 340 },
  inviteCard: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm + spacing.xs },
  inviteText: { fontSize: textSize.body, fontFamily: fonts.display, color: scenery.ink, textAlign: 'center' },
  // Wraps: two clay buttons side by side need ~2 x 110pt at large text.
  inviteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2, alignSelf: 'stretch' },
  inviteButton: { flexGrow: 1, flexBasis: 110 },
  challengePrompt: { fontSize: textSize.small, fontFamily: fonts.bold, color: scenery.ink, textAlign: 'center' },
  done: { gap: spacing.sm + spacing.xs, padding: spacing.lg },
})
