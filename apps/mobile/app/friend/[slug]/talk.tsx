import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo, ActivityIndicator, Animated, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import FriendAvatar, { friendRamp } from '@/components/FriendAvatar'
import Icon from '@/components/Icon'
import LoadState from '@/components/LoadState'
import ScreenHeader from '@/components/ScreenHeader'
import ScreenBackground from '@/components/ScreenBackground'
import { ClaySurface } from '@/components/Clay'
import { playClip, stopClip } from '@/lib/sound'
import { clay, colors, fonts, naturalLineHeight, radii, ramps, scenery, spacing, textSize, textStart, ui, type Ramp } from '@/lib/theme'

/**
 * «حرف بزنیم» — the conversation engine on mobile (web: friends/[slug]/talk).
 * Text input for now; the keyboard's built-in dictation covers voice entry.
 * Replies come with the character's own synthesized voice and autoplay.
 *
 * 2026-09-25 visual convergence with Home: warm page gradient, the header in
 * Home's language (white back disc, friend in a white disc, display-cut name),
 * clay-ish bubbles (the child's in the brand ramp, bright face + ink; the
 * friend's white on a speak-ramp edge) and a clay send button. The bubbles
 * are hand-built rather than ClaySurface: that draws a gradient and an SVG
 * per surface, too much for every message in a long thread.
 *
 * 2026-09-27 (release readiness):
 *  - Keyboard: KeyboardAvoidingView pads on Android too. The app is
 *    edge-to-edge (app.json), so Android no longer resizes the window for
 *    the keyboard and `behavior: undefined` left the input under it. KAV's
 *    padding is relative to where the keyboard actually overlaps the view,
 *    so a window that does resize gets 0 extra, never double.
 *  - While the keyboard is up, the input row drops the bottom safe-area
 *    inset: the keyboard already covers the home indicator / nav bar, and
 *    the inset (34pt on a notched iPhone) showed as a gap above it.
 *  - The keyboard stays up after a send (submitBehavior="submit").
 *  - The friend's art beside the last bubble of each of their turns (one
 *    small disc per turn, not per message, to keep a long thread light),
 *    and an empty thread shows the friend instead of a bare line + 👋.
 *
 * 2026-09-28 visual fidelity (send/dedup/keyboard/lifecycle logic unchanged):
 *  - The friend wears their own ramp (friendRamp: their colour on Home and
 *    the friends grid): header and bubble discs, the edge under their
 *    bubbles, the empty state. The child's bubbles stay the brand amber.
 *  - Bubble text one step up the ladder (body 18) for early readers, 40pt
 *    friend discs.
 *  - «… دارد فکر می‌کند» is now the friend's own turn at the end of the
 *    thread: their disc (thinking pose) and a bubble of three soft dots
 *    (static under Reduce Motion). The same words are its spoken label.
 *  - Composer: the input's rim takes the friend's colour while typing; the
 *    send button draws the Icon set's send glyph, shows a spinner while a reply
 *    is on its way (busy, not faded) and fades only when there's nothing to
 *    send. The empty state says where the keyboard's microphone is.
 */
interface Msg { role: 'child' | 'character'; text: string }

const OFFLINE = 'اتصال برقرار نشد. دوباره تلاش کن'
// The backend's own limit (chatSchema: text max 300). Past it the post came
// back 400 with an English-ish error that showed as the friend's bubble.
const MAX_TEXT = 300

export default function Talk() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const insets = useSafeAreaInsets()
  const [character, setCharacter] = useState<AppCharacter | null>(null)
  const [childId, setChildId] = useState('')
  const [messages, setMessages] = useState<Msg[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }
  // The list loaded but has no friend with this slug: nothing to retry.
  const [notFound, setNotFound] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  // `sending` is state, so two taps (or a tap plus the keyboard's send) in
  // the same frame both read false and both post -- the second with the same
  // stale `text`. The ref closes that gap; the state still drives the UI.
  const sendingRef = useRef(false)
  // send() and load() set state after awaits; skip that once the screen is gone.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    // Leaving the chat also silences a reply that is still playing.
    return () => { mountedRef.current = false; stopClip() }
  }, [])
  const listRef = useRef<FlatList<Msg>>(null)
  // The composer's rim takes the friend's colour while it has focus.
  const [focused, setFocused] = useState(false)

  // Keyboard up or not, for the input row's bottom padding (see the file
  // comment). iOS reports the change before it animates, Android after.
  const [keyboardUp, setKeyboardUp] = useState(false)
  useEffect(() => {
    const ios = Platform.OS === 'ios'
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true))
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false))
    return () => { show.remove(); hide.remove() }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const activeId = await getActiveChildId()
      if (cancelled) return
      if (!activeId) { router.replace('/children'); return }
      setChildId(activeId)
      const [charsRes, historyRes] = await Promise.all([
        api.get<AppCharacter[]>('/api/characters'),
        api.get<Msg[]>(`/api/characters/${slug}/chat/${activeId}`),
      ])
      // A different slug (or a retry) started a newer load: drop this one.
      if (cancelled) return
      // A failed fetch used to leave the spinner up for good.
      if (!charsRes.data) { setError(charsRes.error ?? OFFLINE); return }
      const found = charsRes.data.find((c) => c.slug === slug)
      // An unknown slug used to leave the spinner up for good.
      if (!found) { setNotFound(true); return }
      // A failed history fetch used to fall back to [] -- an empty «سلام کن»
      // thread that looked like a first conversation. Now it is an error
      // with a retry, like the character list.
      if (!historyRes.data) { setError(historyRes.error ?? OFFLINE); return }
      setCharacter(found)
      setMessages(historyRes.data)
    }
    // SecureStore can reject; that is an error to retry, not a stuck spinner.
    load().catch(() => { if (!cancelled) setError(OFFLINE) })
    return () => { cancelled = true }
  }, [slug, reloadKey])

  async function send() {
    const value = text.trim()
    if (!value || sendingRef.current || !childId) return
    sendingRef.current = true
    setText('')
    setSending(true)
    setMessages((m) => [...(m ?? []), { role: 'child', text: value }])
    type Reply = { reply: string; emotion: string; audio_url: string | null }
    // api never rejects except through getToken (SecureStore); a rejection
    // here used to leave sendingRef stuck true and the chat unable to send.
    const res = await api.post<Reply>(`/api/characters/${slug}/chat`, { child_id: childId, text: value })
      .catch(() => ({ data: null as Reply | null, error: OFFLINE }))
    sendingRef.current = false
    // Left the chat while waiting: no state updates, and no reply voice
    // playing over whatever screen the child is on now.
    if (!mountedRef.current) return
    if (res.data) {
      setMessages((m) => [...(m ?? []), { role: 'character', text: res.data!.reply }])
      // Screen readers hear the reply as it arrives (no-op without one).
      AccessibilityInfo.announceForAccessibility(`${character?.name_persian ?? ''}: ${res.data.reply}`)
      if (res.data.audio_url) playClip(res.data.audio_url)
    } else if (res.error) {
      // Daily cap (429) and friends come back as a character-voiced goodbye.
      setMessages((m) => [...(m ?? []), { role: 'character', text: res.error! }])
      AccessibilityInfo.announceForAccessibility(res.error)
    }
    setSending(false)
  }

  // The timer is cleared: it used to outlive a new message (two scrolls) or
  // the screen itself (a scroll on an unmounted list).
  // `sending` too: the typing bubble is the list's footer and must scroll in.
  useEffect(() => {
    if (!messages?.length) return
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    return () => clearTimeout(t)
  }, [messages?.length, sending])

  if (notFound) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState title="این دوست پیدا نشد" error={'این دوست در فهرست دوست‌ها نیست.'} onBack={() => goBack('/friends')} />
        </View>
      </ScreenBackground>
    )
  }
  if (!messages || !character) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={error} onRetry={retry} onBack={() => goBack('/friends')} />
        </View>
      </ScreenBackground>
    )
  }

  const canSend = !!text.trim() && !sending
  // Faded only when there's nothing to send; while a reply is on its way the
  // button shows a spinner at full strength (ClayButton's busy rule).
  const sendFaded = !text.trim() && !sending
  const ramp = friendRamp(character.slug)

  return (
    <ScreenBackground variant="warm">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        {/* The shared child header: back, then the friend's disc (`leading`,
            hidden from readers), then the name as the heading. */}
        <ScreenHeader
          title={character.name_persian}
          subtitle="گوش می‌کنم! بنویس یا با میکروفونِ صفحه‌کلید بگو"
          fallback="/friends"
          leading={
            <View style={[styles.headDisc, { borderColor: ramp.bright }]}>
              <FriendAvatar character={character} size={HEAD_DISC - 10} ramp={ramp} />
            </View>
          }
          style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
        />

        <FlatList
          ref={listRef}
          data={messages}
          // The keyboard (and the typing line) shrink the list; keep the
          // newest message in view instead of letting it slide under.
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.thread}
          ListEmptyComponent={
            // The friend waiting to be greeted, on a soft card of their
            // colour, plus where the keyboard's microphone is.
            <View style={styles.emptyWrap}>
              <ClaySurface ramp={ramp} tone="soft" radius={radii.lg} style={styles.emptyCard} faceStyle={styles.emptyFace}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <FriendAvatar character={character} size={EMPTY_ART} ramp={ramp} emotion="encouraging" />
                </View>
                <Text style={[styles.emptyTitle, { color: ramp.ink }]}>سلام کن تا شروع کنیم!</Text>
                <View style={styles.micHint}>
                  <Icon name="mic" color={ramp.deep} size={20} />
                  <Text style={styles.micHintText}>می‌تونی بنویسی، یا میکروفونِ صفحه‌کلید رو بزنی و بگی.</Text>
                </View>
              </ClaySurface>
            </View>
          }
          // The friend's turn while a reply is on its way: in the thread,
          // where the answer will land.
          ListFooterComponent={sending ? <TypingRow character={character} ramp={ramp} /> : null}
          renderItem={({ item, index }) => {
            const mine = item.role === 'child'
            // The friend's face closes each of their turns (the last of a
            // run of their messages); earlier bubbles in the run keep the
            // same indent so the run lines up.
            const lastOfTurn = !mine && messages[index + 1]?.role !== 'character'
            // Each bubble sits in a row: a row's main axis follows RTL (the
            // child's own at the reading start, the friend's at the end),
            // where alignSelf on a column's cross axis did not (see Clay.tsx).
            return (
              <View
                style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}
                // Who said it, since the side alone doesn't reach a screen reader.
                accessible
                accessibilityLabel={`${mine ? 'تو' : character.name_persian}: ${item.text}`}
              >
                <View style={[styles.bubbleEdge, mine ? styles.edgeMine : [styles.edgeTheirs, { backgroundColor: ramp.bright }]]}>
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
                  </View>
                </View>
                {/* After the bubble in the row = the far (reading-end) edge. */}
                {!mine && (lastOfTurn ? (
                  <View style={[styles.msgDisc, { borderColor: ramp.bright }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <FriendAvatar character={character} size={MSG_DISC - 8} ramp={ramp} />
                  </View>
                ) : <View style={styles.msgSpacer} />)}
              </View>
            )
          }}
        />

        <View style={[styles.inputRow, { paddingBottom: (keyboardUp ? 0 : insets.bottom) + GAP }]}>
          <TextInput
            style={[styles.input, focused && { borderColor: ramp.bright }]}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            value={text}
            onChangeText={setText}
            placeholder="بنویس…"
            placeholderTextColor={colors.muted}
            accessibilityLabel={`پیامت به ${character.name_persian}`}
            maxLength={MAX_TEXT}
            onSubmitEditing={send}
            // Keep the keyboard up for the next message; send() itself
            // ignores an empty or in-flight submit.
            submitBehavior="submit"
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="بفرست"
            accessibilityState={{ disabled: !canSend, busy: sending }}
            style={sendFaded && styles.sendDisabled}
            onPress={send}
            disabled={!canSend}
          >
            {({ pressed }) => (
              <ClaySurface ramp={ramps.brand} tone="bright" pressed={pressed && canSend} radius={radii.pill} edge={clay.edgeSm} faceStyle={styles.sendFace}>
                {sending ? (
                  <ActivityIndicator color={ramps.brand.ink} />
                ) : (
                  // The set's send glyph (mirrors under RTL, toward the reading end).
                  <Icon name="send" color={ramps.brand.ink} size={26} strokeWidth={2.5} />
                )}
              </ClaySurface>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  )
}

/** The friend's turn while their reply is on its way: their disc in the
 *  thinking pose and a bubble of three dots that pulse in turn (still under
 *  Reduce Motion). One element to screen readers, announced politely. */
function TypingRow({ character, ramp }: { character: AppCharacter; ramp: Ramp }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return
      loop = Animated.loop(Animated.stagger(160, dots.map((v) => Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.35, duration: 280, useNativeDriver: true }),
      ]))))
      loop.start()
    }).catch(() => {})
    return () => { cancelled = true; loop?.stop() }
  }, [dots])
  const label = `${character.name_persian} دارد فکر می‌کند…`
  return (
    <View
      style={[styles.bubbleRow, styles.rowTheirs]}
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.bubbleEdge, styles.edgeTheirs, { backgroundColor: ramp.bright }]}>
        <View style={[styles.bubble, styles.theirs, styles.typingBubble]}>
          {dots.map((v, i) => (
            <Animated.View key={i} style={[styles.typingDot, { backgroundColor: ramp.deep, opacity: v }]} />
          ))}
        </View>
      </View>
      <View style={[styles.msgDisc, { borderColor: ramp.bright }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <FriendAvatar character={character} size={MSG_DISC - 8} ramp={ramp} emotion="thinking" />
      </View>
    </View>
  )
}

const GAP = spacing.sm + spacing.xs
const HEAD_DISC = 48
const SEND = 52
const EMPTY_ART = 120
const MSG_DISC = 40

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Layout on top of ScreenHeader's own row: the thread's divider below it.
  header: { paddingBottom: GAP, borderBottomWidth: 2, borderBottomColor: scenery.line },
  // HostAvatar's disc: white, the talk door's ramp (speak) as the rim.
  headDisc: {
    width: HEAD_DISC, height: HEAD_DISC, borderRadius: radii.pill, borderWidth: 3,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thread: { padding: spacing.md, gap: GAP, flexGrow: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', paddingVertical: spacing.lg },
  emptyCard: { alignSelf: 'stretch' },
  emptyFace: { alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  emptyTitle: { textAlign: 'center', fontFamily: fonts.display, fontSize: textSize.body },
  // A row: the mic at the reading start, the words wrapping beside it.
  micHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch', justifyContent: 'center' },
  micHintText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: textSize.caption, color: colors.text, textAlign: 'center' },
  // alignItems flex-end: the friend's disc sits at the bubble's foot.
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs + 2 },
  msgDisc: {
    width: MSG_DISC, height: MSG_DISC, borderRadius: radii.pill, borderWidth: 2,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  msgSpacer: { width: MSG_DISC },
  rowMine: { justifyContent: 'flex-start' },
  rowTheirs: { justifyContent: 'flex-end' },
  // Clay, by hand: a darker edge band under the face (ClaySurface's recipe
  // without its per-surface gradient). maxWidth sits on the outer view so
  // the edge and the face wrap the text together.
  bubbleEdge: { maxWidth: '80%', borderRadius: radii.md, paddingBottom: clay.edgeSm },
  edgeMine: { backgroundColor: ramps.brand.deep, borderBottomStartRadius: spacing.xs },
  // The friend's edge colour is their ramp (set inline).
  edgeTheirs: { borderBottomEndRadius: spacing.xs },
  bubble: { borderRadius: radii.md, paddingHorizontal: spacing.md - 2, paddingVertical: spacing.sm + 2 },
  mine: { backgroundColor: ramps.brand.bright, borderBottomStartRadius: spacing.xs },
  theirs: { backgroundColor: colors.card, borderWidth: 2, borderColor: scenery.line, borderBottomEndRadius: spacing.xs },
  // body (18) for early readers, at Vazirmatn's own line height (marks never clip).
  bubbleText: { fontSize: textSize.body, fontFamily: fonts.regular, color: colors.text, lineHeight: naturalLineHeight(textSize.body), textAlign: textStart },
  // Ink on the bright face (DESIGN_CHARTER: white only on deep).
  bubbleTextMine: { color: ramps.brand.ink, fontFamily: fonts.medium },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: 44 },
  typingDot: { width: 10, height: 10, borderRadius: radii.pill },
  inputRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, alignItems: 'center' },
  // textAlign 'right', not textStart: TextInput does not swap left/right under
  // RTL the way Text does (see textStart in lib/theme.ts).
  input: {
    flex: 1, minHeight: 48, backgroundColor: colors.card, borderRadius: radii.pill,
    borderWidth: 2, borderColor: scenery.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: textSize.small, fontFamily: fonts.regular, color: colors.text, textAlign: 'right',
    writingDirection: 'rtl',
  },
  // Faded and not sinking when there's nothing to send (ClayButton's rule).
  sendDisabled: { opacity: ui.disabledOpacity },
  sendFace: { width: SEND, height: SEND, alignItems: 'center', justifyContent: 'center' },
})
