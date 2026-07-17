import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { characterEmoji } from '@/lib/characterEmoji'
import { playClip } from '@/lib/sound'
import { colors, fonts } from '@/lib/theme'

/**
 * «حرف بزنیم» — the conversation engine on mobile (web: friends/[slug]/talk).
 * Text input for now; the keyboard's built-in dictation covers voice entry.
 * Replies come with the character's own synthesized voice and autoplay.
 */
interface Msg { role: 'child' | 'character'; text: string }

export default function Talk() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const insets = useSafeAreaInsets()
  const [character, setCharacter] = useState<AppCharacter | null>(null)
  const [childId, setChildId] = useState('')
  const [messages, setMessages] = useState<Msg[] | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<Msg>>(null)

  useEffect(() => {
    async function load() {
      const activeId = await getActiveChildId()
      if (!activeId) { router.replace('/children'); return }
      setChildId(activeId)
      const [charsRes, historyRes] = await Promise.all([
        api.get<AppCharacter[]>('/api/characters'),
        api.get<Msg[]>(`/api/characters/${slug}/chat/${activeId}`),
      ])
      setCharacter(charsRes.data?.find((c) => c.slug === slug) ?? null)
      setMessages(historyRes.data ?? [])
    }
    load()
  }, [slug])

  const emoji = useMemo(() => (character ? characterEmoji(character) : '🙂'), [character])

  async function send() {
    const value = text.trim()
    if (!value || sending || !childId) return
    setText('')
    setSending(true)
    setMessages((m) => [...(m ?? []), { role: 'child', text: value }])
    const res = await api.post<{ reply: string; emotion: string; audio_url: string | null }>(
      `/api/characters/${slug}/chat`, { child_id: childId, text: value })
    if (res.data) {
      setMessages((m) => [...(m ?? []), { role: 'character', text: res.data!.reply }])
      if (res.data.audio_url) playClip(res.data.audio_url)
    } else if (res.error) {
      // Daily cap (429) and friends come back as a character-voiced goodbye.
      setMessages((m) => [...(m ?? []), { role: 'character', text: res.error! }])
    }
    setSending(false)
  }

  useEffect(() => {
    if (messages?.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
  }, [messages?.length])

  if (!messages || !character) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <Text style={{ fontSize: 30 }}>{emoji}</Text>
        <View>
          <Text style={styles.name}>{character.name_persian}</Text>
          <Text style={styles.sub}>گوش می‌کنم! بنویس یا با میکروفونِ صفحه‌کلید بگو</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.thread}
        ListEmptyComponent={
          <Text style={styles.empty}>سلام کن تا شروع کنیم! 👋</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'child' ? styles.mine : styles.theirs]}>
            <Text style={[styles.bubbleText, item.role === 'child' && { color: '#fff' }]}>{item.text}</Text>
          </View>
        )}
      />

      {sending && <Text style={styles.typing}>{character.name_persian} دارد فکر می‌کند…</Text>}

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="بنویس…"
          placeholderTextColor={colors.muted}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable style={[styles.send, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending}>
          <Text style={{ fontSize: 18, color: '#fff' }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: colors.card,
  },
  back: { fontSize: 24, color: colors.muted },
  name: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  sub: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
  thread: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, marginTop: 40 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderBottomStartRadius: 4 },
  theirs: { alignSelf: 'flex-end', backgroundColor: colors.card, borderBottomEndRadius: 4 },
  bubbleText: { fontSize: 15, fontFamily: fonts.regular, color: colors.text, lineHeight: 26 },
  typing: { paddingHorizontal: 20, paddingBottom: 4, fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  inputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 6, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: colors.card, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, fontFamily: fonts.regular, color: colors.text, textAlign: 'right',
  },
  send: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
})
