import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, Word } from '@koodakbook/shared'
import { toPersianDigits, wordEmoji } from '@koodakbook/shared'
import QuizCard, { type QuizQuestion } from '@/components/QuizCard'
import MarpeleBoard, { Confetti, Dice } from '@/components/MarpeleBoard'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { LADDERS, SIZE, SNAKES, buildQuestion, preferVisual, sleep } from '@/lib/marpele'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'
import { colors, fonts } from '@/lib/theme'

/* Online مارپله — invite an accepted friend and race turn-by-turn. State is
 * relayed over the socket after each turn; only emoji reactions travel between
 * players (no chat). Reuses the same board + challenge as the offline game. */

const TOKEN_EMOJI = ['🧒', '👧']
const REACTIONS = ['👏', '🎉', '😄', '⭐', '💪']

type Phase = 'loading' | 'lobby' | 'waiting' | 'playing' | 'ended'
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
    mounted.current = true
    async function boot() {
      const childId = await getActiveChildId()
      if (!childId) { router.replace('/children'); return }
      const [childRes, wordsRes, friendsRes] = await Promise.all([
        api.get<Child[]>('/api/children'),
        api.get<Word[]>('/api/words'),
        api.get<{ id: string; name: string }[]>(`/api/friends/of/${childId}`),
      ])
      const child = childRes.data?.find((c) => c.id === childId)
      const lv = child?.level ?? 1
      setMe({ id: childId, name: child?.name ?? 'من' })
      setLevel(lv)
      const all = wordsRes.data ?? []
      const filtered = all.filter((w) => w.stage <= lv + 1)
      setPool(preferVisual(filtered.length >= 4 ? filtered : all, (w) => !!(wordEmoji(w.english) || w.image_url)))
      setFriends((friendsRes.data ?? []).map((f) => ({ ...f, online: false })))

      const socket = await connectSocket(child?.name ?? 'من', '🧒')
      if (!socket) { setNotice('اتصال برقرار نشد'); return }

      socket.on('connect', () => socket.emit('presence:friends'))
      socket.emit('presence:friends')
      socket.on('presence:online', ({ ids }: { ids: string[] }) => {
        if (!mounted.current) return
        setFriends((fs) => fs.map((f) => ({ ...f, online: ids.includes(f.id) })))
      })
      // A friend just came online / went offline — re-query.
      socket.on('presence:refresh', () => socket.emit('presence:friends'))
      socket.on('invite:incoming', (inv: { roomId: string; fromChildId: string; fromName: string; fromEmoji: string }) => {
        if (mounted.current) setInvite({ roomId: inv.roomId, fromName: inv.fromName, fromEmoji: inv.fromEmoji })
      })
      socket.on('invite:offline', () => { if (mounted.current) { setNotice('دوستت الان آنلاین نیست'); setPhase('lobby') } })
      socket.on('invite:declined', ({ name }: { name: string }) => { if (mounted.current) { setNotice(`${name} دعوت را رد کرد`); setPhase('lobby') } })
      socket.on('invite:gone', () => { if (mounted.current) { setNotice('دعوت منقضی شد'); setPhase('lobby') } })
      socket.on('game:start', ({ roomId, players, firstTurn }: { roomId: string; players: RoomInfo['players']; firstTurn: number }) => {
        if (!mounted.current) return
        const myIndex = players.findIndex((p) => p.childId === childId)
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
  }, [])

  // auto-clear a received reaction
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

  // ── turn logic (mine) ──────────────────────────────────────────────────
  const room = roomRef.current
  const myTurn = phase === 'playing' && room?.myIndex === current
  const canRoll = myTurn && !animating && !challenge

  function setPos(idx: number, val: number) {
    setPositions((p) => { const n = [...p]; n[idx] = val; return n })
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

  // ── render ─────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
  }

  if (phase === 'ended') {
    const title = endReason === 'won' ? 'تو بردی! 🏆' : endReason === 'lost' ? 'این بار دوستت برد!' : 'دوستت از بازی خارج شد'
    return (
      <View style={[styles.center, { gap: 12, padding: 24 }]}>
        {endReason === 'won' && <Confetti />}
        <Text style={{ fontSize: 72 }}>{endReason === 'won' ? '🏆' : '🎲'}</Text>
        <Text style={styles.bigTitle}>{title}</Text>
        <Pressable style={styles.primaryButton} onPress={() => setPhase('lobby')}>
          <Text style={styles.primaryText}>بازی دوباره</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>برگشت</Text>
        </Pressable>
      </View>
    )
  }

  if (phase === 'lobby' || phase === 'waiting') {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>→</Text></Pressable>
          <View>
            <Text style={styles.title}>بازی آنلاین 🌐</Text>
            <Text style={styles.subtitle}>یک دوست آنلاین را برای بازی دعوت کن</Text>
          </View>
        </View>

        {notice && <Text style={styles.notice}>{notice}</Text>}

        {friends.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40 }}>🤝</Text>
            <Text style={styles.empty}>هنوز دوستی نداری. از حالت والدین با کد دوستی، دوست اضافه کن.</Text>
          </View>
        ) : (
          friends.map((f) => (
            <Pressable key={f.id} style={styles.friendCard} disabled={phase === 'waiting'} onPress={() => inviteFriend(f)}>
              <Text style={{ fontSize: 30 }}>🧒</Text>
              <Text style={styles.friendName}>{f.name}</Text>
              <View style={[styles.dot, { backgroundColor: f.online ? colors.success : '#cbd5e1' }]} />
              <Text style={[styles.friendStatus, { color: f.online ? colors.success : colors.muted }]}>
                {f.online ? 'آنلاین — دعوت کن' : 'آفلاین'}
              </Text>
            </Pressable>
          ))
        )}

        {/* Incoming invite */}
        <Modal transparent visible={!!invite} animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.inviteCard}>
              <Text style={{ fontSize: 44 }}>{invite?.fromEmoji ?? '🧒'}</Text>
              <Text style={styles.inviteText}>«{invite?.fromName}» تو را به بازی مارپله دعوت کرد!</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable style={styles.acceptBtn} onPress={acceptInvite}><Text style={styles.acceptText}>بریم! 🎲</Text></Pressable>
                <Pressable style={styles.declineBtn} onPress={declineInvite}><Text style={styles.declineText}>نه</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    )
  }

  // phase === 'playing'
  const cur = room?.players[current]
  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { getSocket()?.emit('game:leave', { roomId: room?.roomId }); router.back() }} hitSlop={10}>
          <Text style={styles.back}>✕</Text>
        </Pressable>
        <Text style={[styles.turn, { color: myTurn ? colors.primary : colors.muted }]}>
          {myTurn ? 'نوبت توست! 🎲' : `نوبت ${cur?.name}…`}
        </Text>
      </View>

      <View style={styles.strip}>
        {room?.players.map((p, i) => (
          <View key={p.childId} style={[styles.pcard, i === current && styles.pcardActive]}>
            <Text style={{ fontSize: 18 }}>{TOKEN_EMOJI[i]}</Text>
            <Text style={[styles.pcardName, i === current && { color: '#fff' }]} numberOfLines={1}>
              {p.childId === me.id ? 'تو' : p.name}
            </Text>
            <View style={styles.pcardBadge}><Text style={styles.pcardBadgeText}>{toPersianDigits(positions[i] ?? 0)}</Text></View>
          </View>
        ))}
      </View>

      <View style={styles.boardArea} onLayout={() => {}}>
        <MarpeleBoard positions={positions} emojis={positions.map((_, i) => TOKEN_EMOJI[i])} maxWidth={360} maxHeight={420} />
      </View>

      {reaction && <Text style={styles.reactionFloat}>{reaction.emoji}</Text>}

      <View style={styles.reactionsRow}>
        {REACTIONS.map((e) => (
          <Pressable key={e} onPress={() => react(e)} hitSlop={6}><Text style={{ fontSize: 26 }}>{e}</Text></Pressable>
        ))}
      </View>

      <View style={styles.controls}>
        <Dice value={die} rolling={animating} />
        <Pressable style={[styles.rollButton, !canRoll && styles.rollDisabled]} disabled={!canRoll} onPress={roll}>
          <Text style={styles.rollText}>{myTurn ? 'تاس بینداز! 🎲' : 'صبر کن…'}</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, gap: 10 },
  content: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 22, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  turn: { flex: 1, fontSize: 15, fontFamily: fonts.bold, textAlign: 'center' },
  notice: { fontSize: 13, fontFamily: fonts.medium, color: '#d97706', textAlign: 'center' },
  emptyCard: { backgroundColor: colors.card, borderRadius: 18, padding: 24, alignItems: 'center', gap: 10 },
  empty: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  friendCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 16, padding: 14 },
  friendName: { flex: 1, fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  dot: { width: 10, height: 10, borderRadius: 5 },
  friendStatus: { fontSize: 12, fontFamily: fonts.medium },
  strip: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  pcard: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 2, borderColor: 'transparent' },
  pcardActive: { backgroundColor: colors.primary, borderColor: '#fde047' },
  pcardName: { fontSize: 13, fontFamily: fonts.bold, color: colors.text, maxWidth: 90 },
  pcardBadge: { backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: 7, minWidth: 22, alignItems: 'center' },
  pcardBadgeText: { fontSize: 12, fontFamily: fonts.bold, color: colors.text },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reactionFloat: { position: 'absolute', alignSelf: 'center', bottom: 160, fontSize: 64 },
  reactionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rollButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 20, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 4, borderBottomColor: '#5b21b6' },
  rollDisabled: { backgroundColor: '#cbd5e1', borderBottomColor: '#94a3b8' },
  rollText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.bg, borderRadius: 24, padding: 20, width: '100%', maxWidth: 380, gap: 12 },
  inviteCard: { backgroundColor: colors.card, borderRadius: 24, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center', gap: 12 },
  inviteText: { fontSize: 15, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  challengePrompt: { fontSize: 15, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  acceptBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 24 },
  acceptText: { color: '#fff', fontSize: 15, fontFamily: fonts.bold },
  declineBtn: { backgroundColor: '#e2e8f0', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 20 },
  declineText: { color: colors.text, fontSize: 15, fontFamily: fonts.bold },
  bigTitle: { fontSize: 26, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  primaryButton: { marginTop: 8, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  primaryText: { color: '#fff', fontSize: 17, fontFamily: fonts.bold },
  secondaryButton: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 40 },
  secondaryText: { color: colors.muted, fontSize: 15, fontFamily: fonts.bold },
})
