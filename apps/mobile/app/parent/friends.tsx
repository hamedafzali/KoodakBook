import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { isParentUnlocked } from '@/lib/parentGate'
import { colors, fonts } from '@/lib/theme'

interface FriendReq { id: string; requester_name: string; addressee_child_id: string; addressee_name: string }
interface Friend { id: string; name: string; avatar_url: string | null }

/**
 * Friends (parent mode) — connect children only via a shared code with parent
 * approval. No search, no strangers, no chat. Each child has a code to share;
 * entering a friend's code sends a request the other parent approves.
 */
export default function Friends() {
  const insets = useSafeAreaInsets()
  const [children, setChildren] = useState<Child[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendReq[]>([])
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const loadForChild = useCallback(async (childId: string) => {
    setCode(null)
    const [codeRes, friendsRes] = await Promise.all([
      api.get<{ code: string }>(`/api/friends/code/${childId}`),
      api.get<Friend[]>(`/api/friends/of/${childId}`),
    ])
    if (codeRes.data) setCode(codeRes.data.code)
    setFriends(friendsRes.data ?? [])
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!isParentUnlocked()) { router.replace('/parent'); return }
      let cancelled = false
      async function load() {
        const [childRes, reqRes] = await Promise.all([
          api.get<Child[]>('/api/children'),
          api.get<FriendReq[]>('/api/friends/requests'),
        ])
        if (cancelled) return
        const list = childRes.data ?? []
        setChildren(list)
        setRequests(reqRes.data ?? [])
        const active = selected ?? list[0]?.id ?? null
        setSelected(active)
        if (active) await loadForChild(active)
        setLoading(false)
      }
      load()
      return () => { cancelled = true }
    }, [selected, loadForChild])
  )

  async function shareCode() {
    if (!code) return
    const child = children.find((c) => c.id === selected)
    try {
      await Share.share({ message: `کد دوستی ${child?.name ?? 'کودک'} در کوداک‌بوک: ${code}\nاین کد را در بخش «دوستان» وارد کن تا با هم بازی کنیم!` })
    } catch { /* cancelled */ }
  }

  async function sendRequest() {
    if (!selected) return
    const c = input.trim().toUpperCase()
    if (!c) return
    setMsg(null)
    const res = await api.post<{ friend_name: string; accepted: boolean }>('/api/friends/request', { child_id: selected, code: c })
    if (res.data) {
      setInput('')
      setMsg({ ok: true, text: res.data.accepted ? `${res.data.friend_name} حالا دوست است! ✅` : `درخواست برای ${res.data.friend_name} فرستاده شد ✅` })
      if (res.data.accepted) await loadForChild(selected)
    } else {
      setMsg({ ok: false, text: res.error ?? 'خطا' })
    }
  }

  async function respond(id: string, accept: boolean) {
    await api.post(`/api/friends/requests/${id}/${accept ? 'accept' : 'decline'}`, {})
    setRequests((r) => r.filter((x) => x.id !== id))
    if (accept && selected) await loadForChild(selected)
  }

  async function pickChild(id: string) {
    setSelected(id)
    setMsg(null)
    await loadForChild(id)
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
  }

  const activeChild = children.find((c) => c.id === selected)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>دوستان 🤝</Text>
          <Text style={styles.subtitle}>فقط با کد و تأیید شما — بدون غریبه</Text>
        </View>
      </View>

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {children.map((c) => (
            <Pressable key={c.id} style={[styles.chip, selected === c.id && styles.chipActive]} onPress={() => pickChild(c.id)}>
              <Text style={[styles.chipText, selected === c.id && { color: '#fff' }]}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* This child's code */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>کد دوستی {activeChild?.name}</Text>
        <Text style={styles.code}>{code ?? '…'}</Text>
        <Pressable style={styles.shareButton} onPress={shareCode}>
          <Text style={styles.shareText}>اشتراک‌گذاری کد 📤</Text>
        </Pressable>
        <Text style={styles.hint}>این کد را به خانواده‌ی دوستِ کودک بدهید</Text>
      </View>

      {/* Add a friend by code */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>افزودن دوست با کد</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="KB-XXXXX"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable style={styles.addButton} onPress={sendRequest}>
            <Text style={styles.addText}>ارسال</Text>
          </Pressable>
        </View>
        {msg && <Text style={[styles.msg, { color: msg.ok ? colors.success : colors.danger }]}>{msg.text}</Text>}
      </View>

      {/* Incoming requests */}
      {requests.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>درخواست‌های دوستی</Text>
          <View style={styles.card}>
            {requests.map((r) => (
              <View key={r.id} style={styles.reqRow}>
                <Text style={styles.reqText}>«{r.requester_name}» می‌خواهد دوستِ {r.addressee_name} شود</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={styles.acceptBtn} onPress={() => respond(r.id, true)}><Text style={styles.acceptText}>تأیید</Text></Pressable>
                  <Pressable style={styles.declineBtn} onPress={() => respond(r.id, false)}><Text style={styles.declineText}>رد</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Friends list */}
      <Text style={styles.sectionLabel}>دوستانِ {activeChild?.name}</Text>
      <View style={styles.card}>
        {friends.length === 0 ? (
          <Text style={styles.empty}>هنوز دوستی اضافه نشده — کد را به هم بدهید تا با هم بازی کنند</Text>
        ) : (
          friends.map((f) => (
            <View key={f.id} style={styles.friendRow}>
              <Text style={{ fontSize: 22 }}>🧒</Text>
              <Text style={styles.friendName}>{f.name}</Text>
              <Text style={styles.soon}>بازی آنلاین به‌زودی 🎲</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 10 },
  cardLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  code: { fontSize: 30, fontFamily: fonts.bold, color: colors.primary, letterSpacing: 3, textAlign: 'center', writingDirection: 'ltr' },
  shareButton: { backgroundColor: colors.primarySoft, borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
  shareText: { color: colors.primary, fontSize: 14, fontFamily: fonts.bold },
  hint: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  input: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, fontFamily: fonts.bold, color: colors.text, textAlign: 'center', letterSpacing: 2, writingDirection: 'ltr' },
  addButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 14, fontFamily: fonts.bold },
  msg: { fontSize: 13, fontFamily: fonts.regular },
  sectionLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.muted, marginTop: 8, marginBottom: -2 },
  reqRow: { gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  reqText: { fontSize: 13, fontFamily: fonts.regular, color: colors.text },
  acceptBtn: { backgroundColor: colors.success, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 16 },
  acceptText: { color: '#fff', fontSize: 13, fontFamily: fonts.bold },
  declineBtn: { backgroundColor: '#e2e8f0', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 16 },
  declineText: { color: colors.text, fontSize: 13, fontFamily: fonts.bold },
  empty: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  friendName: { flex: 1, fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  soon: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
})
